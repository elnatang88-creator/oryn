import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft, Clock3, Smartphone } from 'lucide-react'
import { loadOwnerShare } from '../load'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { walletColors, walletStatus, type WalletStatus } from '@/lib/server/wallet'
import { PlanGate } from '@/components/ui'
import { LogoMark } from '@/components/Logo'
import { TrackOnMount } from '@/components/TrackOnMount'

export const metadata = { title: 'Add to Wallet' }

/**
 * Wallet. The preview is rendered from the same card data a real pass would carry. Each platform shows its
 * true state: ready (Google, once configured) or "integration pending" with exactly what's missing.
 */
export default async function WalletPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const { user, share, capsule, design, identity } = await loadOwnerShare(id)
  const allowed = has(await userPlan(await getDb(), user.id), 'share.wallet')
  const status = walletStatus()
  const ua = (await headers()).get('user-agent') ?? ''
  const order: ('apple' | 'google')[] = /Android/i.test(ua) ? ['google', 'apple'] : ['apple', 'google']
  const phone = /iPhone|iPad|Android/i.test(ua)
  const c = walletColors(design)
  return (
    <div className="-mx-4 -my-6 min-h-[calc(100dvh-3.5rem)] bg-soft-50 px-4 pb-10 pt-4 sm:-mx-6 sm:px-6 lg:-my-10 lg:rounded-3xl lg:py-10">
      <div className="mx-auto max-w-sm">
        <TrackOnMount name="wallet_viewed" props={{ card_id: capsule.id, surface: 'wallet' }} />
        <Link href={`/share/${share.id}`} className="btn-quiet -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> My card</Link>
        <h1 className="h1 mt-2">Keep your card in your Wallet</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Open it from your lock screen — even without signal. The pass always opens your active card, so it never needs updating.</p>

        <figure className="mt-6" data-testid="wallet-preview">
          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[22px] shadow-capsule" style={{ background: c.background, color: c.foreground }}>
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="flex items-center gap-2 text-sm font-semibold tracking-wide"><LogoMark size={18} /> ORYN</span>
              <span className="text-[11px] uppercase tracking-widest" style={{ color: c.label }}>Identity</span>
            </div>
            <div className="px-5 pt-6">
              <p className="text-[11px] uppercase tracking-widest" style={{ color: c.label }}>Name</p>
              <p dir="auto" className="text-2xl font-semibold">{identity.displayName}</p>
            </div>
            <div className="flex gap-6 px-5 pt-4">
              {identity.headline && <div><p className="text-[11px] uppercase tracking-widest" style={{ color: c.label }}>Role</p><p dir="auto" className="text-sm">{identity.headline}</p></div>}
              {identity.company && <div><p className="text-[11px] uppercase tracking-widest" style={{ color: c.label }}>Company</p><p dir="auto" className="text-sm">{identity.company}</p></div>}
            </div>
            <div className="mx-auto my-6 grid h-28 w-28 place-items-center rounded-xl bg-white text-center text-[10px] font-semibold text-navy-900">Your permanent<br />ORYN link<br />as a code</div>
          </div>
          <figcaption className="mt-2 text-center text-xs text-ink-muted">Preview of the pass, built from your card “{capsule.name}”.</figcaption>
        </figure>

        {sp.error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" data-testid="wallet-add-failed">Couldn’t add the pass. Nothing was added to your phone — try again later.</p>}
        {!phone && <p className="mt-6 rounded-2xl bg-soft-100 px-4 py-3 text-sm text-navy-900" data-testid="wallet-unsupported">Wallet passes are added from a phone. Open ORYN on your iPhone or Android phone to add this pass.</p>}
        {!allowed ? (
          <div className="mt-6"><PlanGate message="Wallet passes are part of Pro." /></div>
        ) : (
          <div className="mt-6 space-y-3">
            {order.map((p) => <PlatformRow key={p} s={status[p]} back={`/share/${share.id}/wallet`} />)}
          </div>
        )}
        <p className="mt-6 text-xs text-ink-muted">ORYN never says a pass was added — your phone’s Wallet does. Adding a pass creates one permanent link for it. You can stop that link any time from Today or Data &amp; privacy; the pass then opens “no longer shared”.</p>
      </div>
    </div>
  )
}

function PlatformRow({ s, back }: { s: WalletStatus; back: string }) {
  const name = s.platform === 'apple' ? 'Apple Wallet' : 'Google Wallet'
  if (s.configured) {
    return (
      <form method="post" action={`/api/v1/wallet/${s.platform}`} className="card p-4" data-testid={`wallet-${s.platform}-ready`}>
        <input type="hidden" name="back" value={back} />
        <button className="btn w-full bg-black text-white hover:bg-black/85"><Smartphone className="h-5 w-5" aria-hidden="true" /> Add to {name}</button>
      </form>
    )
  }
  return (
    <div className="card p-4" data-testid={`wallet-${s.platform}-pending`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{name}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-signal-warn"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Integration pending</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Not available on this ORYN server yet — nothing will be added to your phone. {s.platform === 'apple' ? 'It needs the company’s Apple Developer account.' : 'It needs the company’s Google Wallet issuer account.'}</p>
      <details className="mt-2 text-xs text-ink-muted"><summary className="cursor-pointer font-semibold">What’s missing</summary><ul className="mt-1 list-disc space-y-0.5 ps-5">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul></details>
    </div>
  )
}
