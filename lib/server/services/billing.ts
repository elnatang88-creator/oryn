import 'server-only'
import { getDb } from '../db'
import { newId } from '../ids'
import { audit } from '../audit'
import { track } from '../analytics'
import { invalid } from '../errors'
import { listPlans, userPlan } from '../plans'

/**
 * Subscription management. No payment provider is connected yet (a founder decision), so plan changes
 * are recorded with provider = 'manual'. When a provider is chosen, its webhook calls applyPlanChange.
 */
export function billingMode(): 'simulated' | 'provider' {
  return process.env.BILLING_PROVIDER ? 'provider' : 'simulated'
}

export async function planPage(userId: string) {
  const db = await getDb()
  return { current: await userPlan(db, userId), plans: (await listPlans(db)).filter((p) => p.active), mode: billingMode() }
}

export async function applyPlanChange(userId: string, planKey: string, provider = 'manual', providerRef: string | null = null) {
  const db = await getDb()
  const plans = await listPlans(db)
  const plan = plans.find((p) => p.key === planKey && p.active)
  if (!plan) throw invalid('Choose a plan.')
  if (plan.key === 'enterprise') throw invalid('Enterprise is set up with our team. Use “Talk to us”.')
  const before = await userPlan(db, userId)
  await db.tx(async (t) => {
    await t.query(`UPDATE users SET plan_key = $2 WHERE id = $1`, [userId, plan.key])
    await t.query(
      `INSERT INTO subscriptions (id, subject_type, subject_id, plan_key, provider, provider_ref) VALUES ($1,'user',$2,$3,$4,$5)
       ON CONFLICT (subject_type, subject_id) DO UPDATE SET plan_key = EXCLUDED.plan_key, provider = EXCLUDED.provider, provider_ref = EXCLUDED.provider_ref, status = 'active'`,
      [newId('sub'), userId, plan.key, provider, providerRef],
    )
    await audit(t, { actor: userId, action: 'billing.plan_changed', targetType: 'user', targetId: userId, meta: { from: before.key, to: plan.key, provider } })
  })
  await track(db, 'plan_changed', { userId, props: { from: before.key, to: plan.key } })
}
