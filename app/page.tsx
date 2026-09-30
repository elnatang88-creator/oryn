import Link from 'next/link'
import { ArrowRight, Hand, Layers, ShieldCheck, Store, Users } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { CapsuleView } from '@/components/CapsuleView'
import type { PublicCapsuleView } from '@/lib/capsule-model'

const SAMPLE: PublicCapsuleView = {
  layer: 'instant', mode: 'personal', modeLabel: 'Personal', displayName: 'Noa', headline: '',
  message: 'Didn’t want to hold up the line. If you’d like to talk, here’s how.', avatarUrl: null, accent: 'blue',
  fields: [{ id: 'f1', kind: 'social', label: 'Instagram', value: 'https://instagram.com/example' }],
  primaryFieldId: 'f1', hasMore: false, canSave: true, canConnect: true, expiresAt: null, oneTime: true, contextLabel: null, eventName: null, isDemo: false,
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/signin" className="btn-quiet">Sign in</Link>
          <Link href="/signup" className="btn-share min-h-[44px] px-4">Get started</Link>
        </nav>
      </header>

      <main id="main">
        <section className="bg-navy-900 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-electric-300">For the moments you can’t stop</p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Leave a way in.<br />Let them decide.</h1>
              <p className="mt-5 max-w-lg text-lg text-soft-200">ORYN lets you share a small, chosen part of who you are in seconds — at a conference, a counter, or a crowded line — and hands the next step to the other person.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-share px-6">Create your first capsule <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
                <Link href="/signin" className="btn border border-white/20 px-6 text-white hover:bg-white/10">Try the demo</Link>
              </div>
              <p className="mt-4 text-sm text-soft-300">The person you share with never needs an account or an app.</p>
            </div>
            <figure className="mx-auto w-full max-w-sm"><CapsuleView view={SAMPLE} preview /><figcaption className="mt-3 text-center text-sm text-soft-300">Example capsule — a fictional person</figcaption></figure>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">Not a card. A capsule.</h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-muted">An Identity Capsule is a small package you control: which details, for how long, and what the other person may do with it. Make one for each part of your life.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Layers, t: 'Three layers', b: 'A first glance. More, only if they ask. A relationship, only if you both want one.' },
              { icon: Hand, t: 'Their choice', b: 'Save, ask to connect, or simply close the page. Passing is silent. Nobody is chased.' },
              { icon: ShieldCheck, t: 'Yours to stop', b: 'Links can expire, open once, or be closed instantly — even after they were opened.' },
            ].map((f) => (
              <div key={f.t} className="rounded-3xl bg-soft-50 p-6">
                <f.icon className="h-7 w-7 text-electric" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-navy-900">{f.t}</h3>
                <p className="mt-1 text-ink-muted">{f.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-soft-50">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-3">
            {[
              { icon: Users, t: 'A thousand people in a hall', b: 'Share with the few who matter. They keep what you chose; you keep where you met and what to do next.' },
              { icon: Store, t: 'A line you can’t hold up', b: 'Leave a first name and one way to say hi. They open it later, or never. Either is fine.' },
              { icon: Layers, t: 'A booth, a desk, a counter', b: 'A station code that stays printed while the person or team behind it changes.' },
            ].map((f) => (
              <div key={f.t} className="card p-6">
                <f.icon className="h-6 w-6 text-electric" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-navy-900">{f.t}</h3>
                <p className="mt-1 text-[15px] text-ink-muted">{f.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">For teams and events</h2>
          <p className="mt-2 text-lg text-ink-muted">Give everyone a controlled identity under one brand. Set event-wide sharing rules. Own the workspace and its data.</p>
          <Link href="/signup" className="btn-share mt-8 px-6">Start free</Link>
        </section>
      </main>

      <footer className="border-t border-soft-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted sm:px-6">
          <Logo />
          <nav className="flex gap-4"><Link href="/privacy">Privacy</Link><Link href="/signin">Sign in</Link></nav>
        </div>
      </footer>
    </div>
  )
}
