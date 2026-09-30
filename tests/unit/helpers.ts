import { getDb } from '@/lib/server/db'
import { signUp } from '@/lib/server/services/auth'
import { applyPlanChange } from '@/lib/server/services/billing'

let n = 0
export async function makeUser(plan: 'free' | 'pro' | 'business' = 'pro', name = 'Test Person') {
  n++
  const email = `user${n}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const r = await signUp({ email, password: 'correct horse battery', displayName: name }, { userAgent: 'vitest', deviceId: null, ipKey: `ip-${n}-${Math.random()}` })
  if (plan !== 'free') await applyPlanChange(r.userId, plan)
  return { id: r.userId, email, token: r.token }
}

export async function db() {
  return getDb()
}

export function fields() {
  return [
    { id: 'f_role01', kind: 'role' as const, label: 'Role', value: 'Designer', layer: 'instant' as const },
    { id: 'f_mail01', kind: 'email' as const, label: 'Email', value: 'me@example.com', layer: 'instant' as const },
    { id: 'f_site01', kind: 'website' as const, label: 'Website', value: 'example.com', layer: 'expanded' as const },
    { id: 'f_phon01', kind: 'phone' as const, label: 'Phone', value: '+1 555 010 9999', layer: 'hidden' as const },
  ]
}
