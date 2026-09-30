import { Check } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { planPage } from '@/lib/server/services/billing'
import { changePlanAction } from '@/app/actions/settings'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Plan' }

const HIGHLIGHTS: Record<string, string[]> = {
  free: ['One capsule', 'QR code and link sharing', 'Save contacts', 'Stop any share, any time'],
  pro: ['A capsule for every kind of moment', '“Learn more” layer', 'Private notes and follow-ups', 'NFC tags and more ways to share', 'Personal insights'],
  business: ['Team workspace with your brand', 'Roles and permissions', 'Event mode', 'Stations and QR destinations', 'Audit log and data export'],
  enterprise: ['SSO and directory sync', 'Custom retention and regions', 'Security review support', 'API access and custom domains'],
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const { changed } = await searchParams
  const user = await requireUser()
  const { current, plans, mode } = await planPage(user.id)
  return (
    <>
      <PageHeader title="Plan" sub="Safety and privacy controls are included on every plan." />
      {changed && changed === current.key && <p className="card mb-4 border-electric/30 bg-soft-100 px-4 py-3 font-medium text-navy-900" role="status" data-testid="plan-changed">You’re now on {current.name}. (Simulated — no payment was taken.)</p>}
      {mode === 'simulated' && <p className="card mb-6 border-dashed px-4 py-3 text-sm text-ink-muted" data-testid="billing-simulated">Payments aren’t connected yet. Switching plans here is a simulation for testing — no charge is made.</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <li key={p.key} className={`card flex flex-col p-5 ${p.key === current.key ? 'border-electric ring-2 ring-electric/20' : ''}`}>
            <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold text-navy-900">{p.name}</h2><span className="text-sm text-ink-muted">{p.price_label ?? 'Pricing coming soon'}</span></div>
            <ul className="mt-3 flex-1 space-y-2 text-[15px]">{(HIGHLIGHTS[p.key] ?? []).map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" aria-hidden="true" />{h}</li>)}</ul>
            <p className="mt-3 text-xs text-ink-muted">Up to {p.limits.capsules} capsule{p.limits.capsules === 1 ? '' : 's'} · {p.limits.historyDays}-day history</p>
            <div className="mt-4">
              {p.key === current.key ? <p className="btn w-full bg-soft-100 text-navy-900">Your plan</p>
                : p.key === 'enterprise' ? <a href="mailto:hello@oryn.example?subject=ORYN%20Enterprise" className="btn-more w-full">Talk to us</a>
                : mode === 'simulated' ? (
                  <ActionForm action={changePlanAction}><input type="hidden" name="plan" value={p.key} /><Submit className="btn-more w-full">Switch to {p.name}</Submit></ActionForm>
                ) : <p className="hint">Checkout opens here once payments are connected.</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
