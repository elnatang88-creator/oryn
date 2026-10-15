import Link from 'next/link'
import { headers } from 'next/headers'
import { Apple, CheckCircle2, Clock3, QrCode, Smartphone, Wallet } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { listCapsules, defaultCapsuleId } from '@/lib/server/services/capsules'
import { walletPassState, applePreviewAllowed } from '@/lib/server/services/wallet-pass'
import { qrSvg } from '@/lib/server/services/owner-card'
import { walletStatus, type WalletStatus } from '@/lib/server/wallet'
import { revokeShareAction } from '@/app/actions/sharing'
import { PageHeader, PlanGate, Section, relTime } from '@/components/ui'
import { BRAND } from '@/lib/brand'

export const metadata = { title: 'Wallet' }

/**
 * Wallet Center: one place that tells the truth about passes — which card they follow, whether Apple / Google
 * are connected on this server, the permanent pass link and its state, and what to do when a pass won't add.
 */
export default async function WalletCenter({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams])
  const db = await getDb()
  const [capsules, defaultId, allowed, pass] = await Promise.all([listCapsules(user.id), defaultCapsuleId(user.id), userPlan(db, user.id).then((p) => has(p, 'share.wallet')), walletPassState(user.id)])
  const status = walletStatus()
  const active = capsules.find((c) => c.id === defaultId) ?? capsules[0]
  const ua = (await headers()).get('user-agent') ?? ''
  const phone = /iPhone|iPad|Android/i.test(ua)
  const order: ('apple' | 'google')[] = /Android/i.test(ua) ? ['google', 'apple'] : ['apple', 'google']
  const svg = pass ? await qrSvg(pass.url) : null
  const preview = applePreviewAllowed() && !status.apple.configured
  return (
    <>
      <PageHeader title="Wallet" sub="Your card as a pass on the lock screen. The pass always opens your active card, so it never needs reissuing." />
      {sp.error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" data-testid="wallet-add-failed">Couldn’t add the pass. Nothing was added to your phone — see “When a pass won’t add” below.</p>}

      <Section title="The card on the pass">
        {active ? (
          <div className="card flex items-center gap-3 px-4 py-3" data-testid="wallet-card">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-white"><Wallet className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p dir="auto" className="truncate font-semibold">{active.name}</p><p className="text-sm text-ink-muted">Active card · passes follow whichever card you make active</p></div>
            <Link href="/capsules" className="text-sm font-semibold text-electric-600">Change</Link>
          </div>
        ) : (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">Create a card first — the pass is built from it. <Link href="/capsules/new" className="font-semibold text-electric-600">Create my card</Link></p>
        )}
      </Section>

      {!allowed ? <PlanGate message="Wallet passes are part of Pro." /> : (
        <Section title="Add to a phone">
          {!phone && <p className="mb-3 rounded-2xl bg-soft-100 px-4 py-3 text-sm text-navy-900" data-testid="wallet-unsupported">Passes are added from a phone. Open {BRAND} on your iPhone or Android phone to add one.</p>}
          <div className="space-y-3">{order.map((p) => <PlatformRow key={p} s={status[p]} preview={p === 'apple' && preview} disabled={!active} />)}</div>
        </Section>
      )}

      <Section title="Pass link">
        {pass ? (
          <div className="card p-4" data-testid="wallet-pass-link">
            <div className="flex items-start gap-4">
              <div className="w-24 shrink-0 rounded-xl bg-white p-1 ring-1 ring-soft-200" role="img" aria-label="Pass code" dangerouslySetInnerHTML={{ __html: svg! }} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-center gap-1 font-semibold text-signal-ok"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Live · created {relTime(pass.createdAt)}</p>
                <p className="mt-1 text-ink-muted">Opened {pass.opens} {pass.opens === 1 ? 'time' : 'times'} from a pass. Issued: Apple {pass.issued.apple}, Google {pass.issued.google}{pass.issued.last_at ? ` · last ${relTime(pass.issued.last_at)}` : ''}.</p>
                <p className="mt-1 text-xs text-ink-muted">One permanent link for all your passes. Stopping it makes every pass open “no longer shared”.</p>
              </div>
            </div>
            <form action={revokeShareAction} className="mt-3 text-end"><input type="hidden" name="id" value={pass.shareId} /><input type="hidden" name="back" value="/wallet" /><button className="btn-quiet text-sm text-signal-stop" data-testid="wallet-stop">Stop the pass link</button></form>
          </div>
        ) : (
          <p className="card px-4 py-4 text-[15px] text-ink-muted" data-testid="wallet-no-pass">No pass yet. The permanent pass link is created the first time you add a pass — never before.</p>
        )}
      </Section>

      <Section title="How it installs">
        <ol className="card list-decimal space-y-2 px-4 py-4 ps-9 text-[15px]">
          <li><strong>iPhone:</strong> tap “Add to Apple Wallet”. Safari downloads the pass and iOS shows it; tap <em>Add</em> in the top-right. Nothing is added until iOS says so.</li>
          <li><strong>Android:</strong> tap “Add to Google Wallet”. Google’s own “Save to Google Wallet” page opens; confirm there.</li>
          <li>Show the pass from the lock screen; the person scans its code and lands on your active card — even without signal on your side.</li>
        </ol>
      </Section>

      <Section title="When a pass won’t add">
        <ul className="card list-disc space-y-2 px-4 py-4 ps-9 text-[15px] text-ink-muted">
          <li><span className="text-ink">“Integration pending”</span> means this {BRAND} server has no Apple / Google wallet credentials yet. Nothing is wrong on your phone.</li>
          <li><span className="text-ink">iOS says “Pass not valid”</span>: the pass is unsigned (a development preview) or the server’s certificate expired. Ask the operator; previews never install by design.</li>
          <li><span className="text-ink">The pass opens “no longer shared”</span>: the pass link was stopped. Add the pass again to create a new link.</li>
          <li><span className="text-ink">Old details on the pass</span>: the pass is a key to your <em>live</em> card — details update when the card is opened, not on the pass face.</li>
        </ul>
      </Section>
    </>
  )
}

function PlatformRow({ s, preview, disabled }: { s: WalletStatus; preview: boolean; disabled: boolean }) {
  const name = s.platform === 'apple' ? 'Apple Wallet' : 'Google Wallet'
  const Icon = s.platform === 'apple' ? Apple : Smartphone
  if (s.configured) {
    return (
      <form method="post" action={`/api/v1/wallet/${s.platform}`} className="card p-4" data-testid={`wallet-${s.platform}-ready`}>
        <input type="hidden" name="back" value="/wallet" />
        <button className="btn w-full bg-black text-white hover:bg-black/85" disabled={disabled}><Icon className="h-5 w-5" aria-hidden="true" /> Add to {name}</button>
        <p className="mt-2 text-center text-xs text-ink-muted">{name} connected on this server.</p>
      </form>
    )
  }
  return (
    <div className="card p-4" data-testid={`wallet-${s.platform}-pending`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{name}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-signal-warn"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Integration pending</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Not connected on this {BRAND} server — nothing will be added to your phone. {s.platform === 'apple' ? 'It needs the company’s Apple Developer certificates.' : 'It needs the company’s Google Wallet issuer account.'}</p>
      <details className="mt-2 text-xs text-ink-muted"><summary className="cursor-pointer font-semibold">What’s missing</summary><ul className="mt-1 list-disc space-y-0.5 ps-5">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul></details>
      {preview && (
        <form method="post" action="/api/v1/wallet/apple" className="mt-3 rounded-xl border border-dashed border-soft-300 p-3" data-testid="wallet-apple-preview">
          <input type="hidden" name="back" value="/wallet" /><input type="hidden" name="preview" value="1" />
          <p className="text-xs font-semibold text-navy-900">Developer preview (unsigned)</p>
          <p className="text-xs text-ink-muted">Downloads the packaged archive without a signature, for inspecting pass.json and the manifest. It will <strong>not</strong> install on a device.</p>
          <button className="btn-more mt-2 w-full text-sm" disabled={disabled}><QrCode className="h-4 w-4" aria-hidden="true" /> Download unsigned preview</button>
        </form>
      )}
    </div>
  )
}
