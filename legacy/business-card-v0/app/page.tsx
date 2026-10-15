import Link from 'next/link'
import { BusinessCard } from '@/components/card/BusinessCard'
import { ArrowRight, Wallet, QrCode, BarChart3, Users, Zap, Shield } from 'lucide-react'

const DEMO_PROFILE = {
  full_name: 'Alexandra Chen',
  title: 'Managing Director',
  company: 'Meridian Capital',
  email: 'a.chen@meridiancap.com',
  phone: '+1 (212) 555-0191',
  website: 'https://meridiancap.com',
  card_style: 'noir' as const,
}

const features = [
  {
    icon: Wallet,
    title: 'Apple & Google Wallet',
    desc: 'Add your card to any wallet with a single tap. Always accessible, even offline.',
  },
  {
    icon: QrCode,
    title: 'Instant QR Sharing',
    desc: 'Generate a QR code that shares your full digital identity in seconds.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    desc: 'See who viewed your card, when, and from where — in real time.',
  },
  {
    icon: Users,
    title: 'Lead Capture',
    desc: 'Turn every card view into a potential connection with built-in contact forms.',
  },
  {
    icon: Zap,
    title: 'Instant Updates',
    desc: 'Change your details once. Everyone with your card sees the update immediately.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    desc: "You control what's visible and who can reach you. Always.",
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Start building your presence.',
    features: ['1 digital card', 'QR sharing', 'Basic analytics (30 days)', 'Public profile page'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    desc: 'For serious networkers.',
    features: ['5 digital cards', 'Apple & Google Wallet', 'Full analytics', 'Lead capture & tracking', 'Email support'],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Elite',
    price: '$49',
    period: '/month',
    desc: 'The complete identity platform.',
    features: ['Unlimited cards', 'Everything in Pro', 'Custom domain', 'API access', 'Priority support', 'Team management'],
    cta: 'Go Elite',
    highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-obsidian overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 glass-panel border-b border-obsidian-border/30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-lg tracking-[0.25em] gold-text">ORYN</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-cream/50">
            <a href="#features" className="hover:text-cream transition-colors">Features</a>
            <a href="#card" className="hover:text-cream transition-colors">The Card</a>
            <a href="#pricing" className="hover:text-cream transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm px-4 py-2">Sign in</Link>
            <Link href="/signup" className="btn-primary text-sm px-5 py-2">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16 bg-hero-radial">
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-100 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center py-24">
            {/* Left — copy */}
            <div className="space-y-8 animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/8 border border-gold/15 text-gold text-xs tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-gold" />
                Now available — Apple & Google Wallet
              </div>

              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] text-cream">
                Your identity,{' '}
                <span className="gold-text">perfected.</span>
              </h1>

              <p className="text-lg text-cream/50 leading-relaxed max-w-md">
                The luxury digital business card that opens doors, tracks opportunities,
                and makes every introduction unforgettable.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/create" className="btn-primary px-7 py-3.5 text-base">
                  Create Your Card <ArrowRight size={16} />
                </Link>
                <Link href="/signup" className="btn-secondary px-7 py-3.5 text-base">
                  View Demo
                </Link>
              </div>

              <div className="flex items-center gap-6 pt-4 text-xs text-cream/30 tracking-wider">
                <span>NO CREDIT CARD REQUIRED</span>
                <span className="w-1 h-1 rounded-full bg-cream/20" />
                <span>SETUP IN 2 MINUTES</span>
                <span className="w-1 h-1 rounded-full bg-cream/20" />
                <span>FREE FOREVER PLAN</span>
              </div>
            </div>

            {/* Right — card preview */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[420px]">
                {/* Glow behind card */}
                <div className="absolute inset-0 blur-3xl bg-gold/8 rounded-full scale-90" />
                {/* Floating card with CSS animation */}
                <div className="animate-card-float" style={{ perspective: '1200px' }}>
                  <BusinessCard profile={DEMO_PROFILE} size="full" />
                </div>
                {/* Floating stat chips */}
                <div className="absolute -top-4 -right-4 glass-panel px-3 py-2 rounded-chip text-xs text-cream/70 border border-gold/10 animate-fade-in">
                  <span className="text-gold font-semibold">↑ 2,847</span> views this month
                </div>
                <div className="absolute -bottom-4 -left-4 glass-panel px-3 py-2 rounded-chip text-xs text-cream/70 border border-gold/10 animate-fade-in">
                  <span className="text-gold font-semibold">12</span> new leads today
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 relative">
        <div className="section-divider mb-28" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <p className="text-xs text-gold tracking-[0.3em] uppercase">Everything you need</p>
            <h2 className="font-display text-4xl font-semibold text-cream">
              Built for those who mean business
            </h2>
            <p className="text-cream/40 max-w-lg mx-auto">
              Every feature designed with the same obsessive attention to detail
              as the world's finest luxury brands.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="stat-card group hover:border-gold/15 transition-all duration-300 space-y-4"
              >
                <div className="w-10 h-10 rounded-chip bg-gold/8 border border-gold/15 flex items-center justify-center group-hover:bg-gold/12 transition-colors">
                  <Icon size={18} className="text-gold" />
                </div>
                <div>
                  <h3 className="text-cream font-medium mb-2">{title}</h3>
                  <p className="text-sm text-cream/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Card showcase */}
      <section id="card" className="py-28 bg-obsidian-soft/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <p className="text-xs text-gold tracking-[0.3em] uppercase">The Card</p>
              <h2 className="font-display text-4xl font-semibold text-cream leading-tight">
                Crafted with the precision of a Centurion card
              </h2>
              <p className="text-cream/40 leading-relaxed">
                Your ORYN card carries the weight of intent. Deep matte black, gold accents,
                and every detail calibrated to make the right impression — every time.
              </p>
              <ul className="space-y-3 text-sm text-cream/60">
                {['Custom name & title', 'Company branding', 'Contact details', 'Social links', 'Multiple card styles'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/create" className="btn-primary inline-flex">
                Design Your Card <ArrowRight size={14} />
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="relative w-full max-w-[440px]">
                <div className="absolute inset-0 blur-3xl bg-olive/10 rounded-full" />
                <BusinessCard profile={DEMO_PROFILE} size="full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28">
        <div className="section-divider mb-28" />
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <p className="text-xs text-gold tracking-[0.3em] uppercase">Pricing</p>
            <h2 className="font-display text-4xl font-semibold text-cream">
              Choose your tier
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`relative rounded-panel p-7 flex flex-col ${
                  plan.highlight
                    ? 'bg-obsidian-card border border-gold/25 shadow-glow-sm'
                    : 'bg-obsidian-soft/50 border border-obsidian-border'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-gold text-obsidian text-xs font-medium rounded-full tracking-wider">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-lg text-cream mb-1">{plan.name}</h3>
                  <p className="text-xs text-cream/40 mb-4">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`font-display text-4xl font-semibold ${plan.highlight ? 'gold-text' : 'text-cream'}`}>
                      {plan.price}
                    </span>
                    <span className="text-sm text-cream/40">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-cream/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold/60 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/signup"
                  className={plan.highlight ? 'btn-primary text-center' : 'btn-secondary text-center'}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 text-center relative">
        <div className="section-divider mb-28" />
        <div className="max-w-2xl mx-auto px-6 space-y-8">
          <h2 className="font-display text-5xl font-semibold text-cream leading-tight">
            Every great connection<br />starts with an introduction.
          </h2>
          <p className="text-cream/40">
            Join thousands of executives, founders, and professionals who've elevated their identity with ORYN.
          </p>
          <Link href="/create" className="btn-primary px-10 py-4 text-base inline-flex">
            Create Your Card — Free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-obsidian-border/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cream/30">
          <span className="font-display tracking-[0.25em] gold-text">ORYN</span>
          <span>© {new Date().getFullYear()} ORYN. All rights reserved.</span>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="hover:text-cream/60 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-cream/60 transition-colors">Get Started</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
