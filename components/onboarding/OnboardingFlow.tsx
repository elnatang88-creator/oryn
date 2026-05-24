'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { BusinessCard } from '@/components/card/BusinessCard'
import { cn } from '@/lib/utils'
import {
  ArrowRight, Check, Eye, Users, Copy, Share2,
  Wallet, Linkedin, Twitter, Globe, Phone, Mail,
  MapPin, X, ChevronRight, Zap,
} from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const FAKE_VIEWERS = [
  { name: 'James Blackwood', initials: 'JB', city: 'New York',    company: 'Blackstone'   },
  { name: 'Sophie Laurent',  initials: 'SL', city: 'Paris',       company: 'LVMH'         },
  { name: 'Marcus Chen',     initials: 'MC', city: 'Hong Kong',   company: 'Sequoia'      },
  { name: 'Aisha Khalil',    initials: 'AK', city: 'Dubai',       company: 'ADIA'         },
  { name: 'Oliver Pemberton',initials: 'OP', city: 'London',      company: 'Barclays'     },
  { name: 'Isabella Rossi',  initials: 'IR', city: 'Milan',       company: 'Ferrari'      },
  { name: 'David Nakamura',  initials: 'DN', city: 'Tokyo',       company: 'SoftBank'     },
]

const GENERATION_PHASES = [
  { text: 'Crafting your identity…',    ms: 1400 },
  { text: 'Forging the card…',          ms: 1300 },
  { text: 'Securing your presence…',    ms: 1200 },
  { text: 'Publishing your profile…',   ms: 1000 },
  { text: 'Your card is ready.',         ms: 9999 },
]

const STEP_ORDER = ['identity', 'role', 'contact', 'social'] as const
type InputStep = typeof STEP_ORDER[number]
type FlowStep  = InputStep | 'generating' | 'success'

interface Draft {
  full_name: string; title: string;    company: string
  email: string;     phone: string;    website: string
  linkedin_url: string; twitter_url: string
  card_style: 'noir'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  const first = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const tag   = Math.random().toString(36).slice(2, 6)
  return first ? `${first}_${tag}` : `oryn_${tag}`
}

const spring = { type: 'spring', stiffness: 280, damping: 26 }
const stepAnim = {
  initial: { opacity: 0, y: 36 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -18, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
}

// ─── Reusable luxury underline input ─────────────────────────────────────────

interface LuxInputProps {
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  autoFocus?: boolean
  onEnter?: () => void
  size?: 'xl' | 'lg' | 'md'
}

function LuxInput({ value, onChange, placeholder, type = 'text', autoFocus, onEnter, size = 'lg' }: LuxInputProps) {
  return (
    <div className="relative group">
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        className={cn(
          'w-full bg-transparent outline-none text-cream placeholder-cream/20',
          'border-b border-gold/20 focus:border-gold/70 transition-colors duration-300 pb-3',
          'font-display',
          size === 'xl' && 'text-5xl md:text-6xl',
          size === 'lg' && 'text-3xl md:text-4xl',
          size === 'md' && 'text-xl md:text-2xl',
        )}
      />
      {/* animated underline */}
      <motion.div
        className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-gold/60 via-gold to-gold/60"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: value ? 1 : 0 }}
        style={{ originX: 0 }}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

// ─── Continue button ──────────────────────────────────────────────────────────

function ContinueBtn({ onClick, label = 'Continue', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: disabled ? 0.3 : 1, y: 0 }}
      transition={{ delay: 0.1, ...spring }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-3 px-8 py-4 rounded-chip font-medium text-obsidian disabled:cursor-not-allowed"
      style={{
        background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 100%)',
        boxShadow: disabled ? 'none' : '0 8px 24px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
      }}
    >
      {label}
      <ArrowRight size={16} />
    </motion.button>
  )
}

// ─── Step 1 – Identity ────────────────────────────────────────────────────────

function IdentityStep({ draft, setDraft, onNext }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void }) {
  return (
    <motion.div {...stepAnim} className="space-y-10 md:space-y-16">
      <div className="space-y-3">
        <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">Step 1 of 4</p>
        <h2 className="font-display text-3xl md:text-5xl text-cream leading-tight">
          What's your name?
        </h2>
        <p className="text-cream/40 text-sm">This is how you'll be introduced to the world.</p>
      </div>

      <LuxInput
        value={draft.full_name}
        onChange={v => setDraft({ ...draft, full_name: v })}
        placeholder="Alexandra Chen"
        autoFocus
        size="xl"
        onEnter={() => draft.full_name.trim() && onNext()}
      />

      <ContinueBtn onClick={onNext} disabled={!draft.full_name.trim()} />
    </motion.div>
  )
}

// ─── Step 2 – Role ────────────────────────────────────────────────────────────

const TITLE_SUGGESTIONS = ['CEO', 'Founder', 'Managing Director', 'Partner', 'VP', 'Consultant']

function RoleStep({ draft, setDraft, onNext }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void }) {
  return (
    <motion.div {...stepAnim} className="space-y-10 md:space-y-14">
      <div className="space-y-3">
        <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">Step 2 of 4</p>
        <h2 className="font-display text-3xl md:text-5xl text-cream leading-tight">
          What do you do?
        </h2>
        <p className="text-cream/40 text-sm">Your title and where you do it.</p>
      </div>

      <div className="space-y-8">
        <LuxInput
          value={draft.title}
          onChange={v => setDraft({ ...draft, title: v })}
          placeholder="Managing Director"
          autoFocus
          size="lg"
        />

        {/* Quick pick chips */}
        {!draft.title && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap gap-2"
          >
            {TITLE_SUGGESTIONS.map(t => (
              <button key={t}
                onClick={() => setDraft({ ...draft, title: t })}
                className="px-3 py-1.5 rounded-full text-xs text-cream/50 border border-obsidian-border hover:border-gold/30 hover:text-gold transition-all"
              >
                {t}
              </button>
            ))}
          </motion.div>
        )}

        <LuxInput
          value={draft.company}
          onChange={v => setDraft({ ...draft, company: v })}
          placeholder="Meridian Capital"
          size="lg"
          onEnter={() => draft.title.trim() && onNext()}
        />
      </div>

      <ContinueBtn onClick={onNext} disabled={!draft.title.trim()} />
    </motion.div>
  )
}

// ─── Step 3 – Contact ─────────────────────────────────────────────────────────

function ContactStep({ draft, setDraft, onNext }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void }) {
  return (
    <motion.div {...stepAnim} className="space-y-10 md:space-y-14">
      <div className="space-y-3">
        <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">Step 3 of 4</p>
        <h2 className="font-display text-3xl md:text-5xl text-cream leading-tight">
          How can people reach you?
        </h2>
        <p className="text-cream/40 text-sm">Every field is optional — add what feels right.</p>
      </div>

      <div className="space-y-8">
        {[
          { icon: Mail,  key: 'email',   placeholder: 'you@company.com',    type: 'email' },
          { icon: Phone, key: 'phone',   placeholder: '+1 (555) 000-0000',  type: 'tel'   },
          { icon: Globe, key: 'website', placeholder: 'company.com',        type: 'url'   },
        ].map(({ icon: Icon, key, placeholder, type }) => (
          <div key={key} className="flex items-center gap-4">
            <Icon size={16} className="text-gold/40 shrink-0 mt-1" />
            <div className="flex-1">
              <LuxInput
                value={draft[key as keyof Draft] as string}
                onChange={v => setDraft({ ...draft, [key]: v })}
                placeholder={placeholder}
                type={type}
                size="md"
              />
            </div>
          </div>
        ))}
      </div>

      <ContinueBtn onClick={onNext} label="Continue" />
    </motion.div>
  )
}

// ─── Step 4 – Social ─────────────────────────────────────────────────────────

function SocialStep({ draft, setDraft, onNext }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void }) {
  return (
    <motion.div {...stepAnim} className="space-y-10 md:space-y-14">
      <div className="space-y-3">
        <p className="text-gold/70 text-xs tracking-[0.3em] uppercase">Step 4 of 4</p>
        <h2 className="font-display text-3xl md:text-5xl text-cream leading-tight">
          Link your presence.
        </h2>
        <p className="text-cream/40 text-sm">Optional — skip anytime.</p>
      </div>

      <div className="space-y-8">
        {[
          { icon: Linkedin, key: 'linkedin_url', placeholder: 'linkedin.com/in/yourname' },
          { icon: Twitter,  key: 'twitter_url',  placeholder: 'twitter.com/yourhandle'  },
        ].map(({ icon: Icon, key, placeholder }) => (
          <div key={key} className="flex items-center gap-4">
            <Icon size={16} className="text-gold/40 shrink-0 mt-1" />
            <div className="flex-1">
              <LuxInput
                value={draft[key as keyof Draft] as string}
                onChange={v => setDraft({ ...draft, [key]: v })}
                placeholder={placeholder}
                size="md"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <ContinueBtn onClick={onNext} label="Create My Card" />
        <button onClick={onNext} className="text-sm text-cream/30 hover:text-cream/60 transition-colors">
          Skip
        </button>
      </div>
    </motion.div>
  )
}

// ─── Generating Screen ────────────────────────────────────────────────────────

function GeneratingScreen({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [phase, setPhase]     = useState(0)
  const [progress, setProgress] = useState(0)
  const [showCard, setShowCard] = useState(false)

  useEffect(() => {
    let p = 0
    let current = 0
    const totalMs = GENERATION_PHASES.slice(0, -1).reduce((s, ph) => s + ph.ms, 0)
    const tick = 30

    const bar = setInterval(() => {
      p = Math.min(p + (tick / totalMs) * 100, 100)
      setProgress(p)
    }, tick)

    const advance = (i: number) => {
      if (i >= GENERATION_PHASES.length - 1) {
        clearInterval(bar)
        setProgress(100)
        setTimeout(() => setShowCard(true), 400)
        setTimeout(() => onDone(), 2800)
        return
      }
      setTimeout(() => {
        setPhase(i + 1)
        advance(i + 1)
      }, GENERATION_PHASES[i].ms)
    }

    advance(0)
    return () => clearInterval(bar)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-obsidian"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/4 blur-3xl" />
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-obsidian-border">
        <motion.div
          className="h-full bg-gradient-to-r from-gold/60 via-gold to-gold-shine"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {!showCard ? (
          <motion.div
            key="phases"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-12 px-6"
          >
            <span className="font-display tracking-[0.3em] gold-text text-sm">ORYN</span>

            <div className="text-center space-y-6">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    'font-display leading-tight',
                    phase === GENERATION_PHASES.length - 1
                      ? 'text-4xl md:text-5xl gold-text'
                      : 'text-2xl md:text-3xl text-cream'
                  )}
                >
                  {GENERATION_PHASES[phase].text}
                </motion.p>
              </AnimatePresence>

              {/* Pulsing dots */}
              {phase < GENERATION_PHASES.length - 1 && (
                <div className="flex items-center justify-center gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-gold/60"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thin progress indicator */}
            <div className="w-48 h-px bg-obsidian-border overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-gold rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="card-reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-8 px-6"
          >
            {/* 3D card flip in */}
            <div style={{ perspective: 1200 }}>
              <motion.div
                initial={{ rotateY: -90, opacity: 0, scale: 0.9 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <BusinessCard profile={draft} size="lg" />

                {/* Gold shimmer sweep */}
                <motion.div
                  className="absolute inset-0 rounded-card pointer-events-none overflow-hidden"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.4, delay: 1.4 }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(105deg, transparent 30%, rgba(245,230,163,0.3) 50%, transparent 70%)',
                    }}
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1.0, delay: 0.5, ease: 'easeInOut' }}
                  />
                </motion.div>

                {/* Glow ring */}
                <motion.div
                  className="absolute -inset-4 rounded-[28px] pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.8, delay: 0.3 }}
                  style={{ boxShadow: '0 0 60px 20px rgba(201,168,76,0.25)' }}
                />
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="font-display text-xl gold-text tracking-wide"
            >
              Your card is forged.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Viewer Notification ──────────────────────────────────────────────────────

interface Viewer { name: string; initials: string; city: string; company: string }

function ViewerToast({ viewer, onDismiss }: { viewer: Viewer; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      initial={{ x: 320, opacity: 0, scale: 0.92 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 320, opacity: 0, scale: 0.92 }}
      transition={spring}
      className="flex items-center gap-3 px-4 py-3 rounded-panel max-w-[280px]"
      style={{
        background: 'rgba(28,28,30,0.95)',
        border: '1px solid rgba(201,168,76,0.2)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)',
      }}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-olive/40 to-olive/20 border border-olive/30 flex items-center justify-center text-xs font-display font-semibold text-olive-subtle shrink-0">
        {viewer.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shrink-0" />
          <p className="text-xs text-cream/80 font-medium truncate">{viewer.name}</p>
        </div>
        <p className="text-xs text-cream/40 truncate flex items-center gap-1 mt-0.5">
          <MapPin size={10} className="text-gold/50" />
          {viewer.city} · {viewer.company}
        </p>
      </div>
      <div className="shrink-0">
        <p className="text-[10px] text-cream/30">viewed your card</p>
      </div>
    </motion.div>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCount({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-4xl font-semibold gold-text"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

// ─── Apple Wallet Modal ───────────────────────────────────────────────────────

function WalletModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [state, setState] = useState<'dropping' | 'done'>('dropping')

  useEffect(() => {
    const t = setTimeout(() => setState('done'), 1600)
    const c = setTimeout(onClose, 3400)
    return () => { clearTimeout(t); clearTimeout(c) }
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(24px)' }}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Phone silhouette */}
        <div className="relative w-[180px] h-[340px] rounded-[32px] border-2 border-gold/25 bg-obsidian-card overflow-hidden flex flex-col items-center"
          style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.1)' }}
        >
          {/* Notch */}
          <div className="w-16 h-4 bg-obsidian rounded-b-2xl mt-2" />

          {/* Wallet UI mockup */}
          <div className="flex-1 w-full flex flex-col items-center justify-center px-3 pb-4">
            <p className="text-[10px] text-cream/30 tracking-widest mb-4">APPLE WALLET</p>

            {/* Card dropping in */}
            <motion.div
              initial={{ y: -300, rotate: -5 }}
              animate={{ y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.3 }}
              className="w-full"
            >
              <div className="w-full rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1C1C1E 0%, #252523 100%)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  padding: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                <p className="text-[8px] tracking-widest text-gold/80 font-display mb-2">ORYN</p>
                <p className="text-[11px] text-gold font-display font-semibold leading-tight">
                  {draft.full_name || 'Your Name'}
                </p>
                <p className="text-[8px] text-cream/50 mt-0.5">{draft.title || 'Your Title'}</p>
                <div className="mt-2 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              </div>
            </motion.div>
          </div>

          {/* Home indicator */}
          <div className="w-24 h-1 bg-cream/20 rounded-full mb-2" />
        </div>

        {/* Status */}
        <AnimatePresence mode="wait">
          {state === 'dropping' ? (
            <motion.p key="adding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-cream/50 text-sm"
            >
              Adding to Wallet…
            </motion.p>
          ) : (
            <motion.div key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <Check size={14} className="text-green-400" />
              </div>
              <p className="text-cream/80 text-sm font-medium">Added to Apple Wallet</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── QR Reveal ────────────────────────────────────────────────────────────────

function QRReveal({ username }: { username: string }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative">
      {/* Scanning line animation while loading */}
      <AnimatePresence>
        {!revealed && (
          <motion.div
            className="absolute inset-0 z-10 bg-obsidian-card rounded-panel flex items-center justify-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative w-32 h-32">
              {/* QR placeholder grid */}
              <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-px p-1">
                {Array.from({ length: 64 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="bg-cream/20 rounded-[1px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: Math.random() > 0.3 ? 1 : 0 }}
                    transition={{ delay: i * 0.008, duration: 0.15 }}
                  />
                ))}
              </div>
              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent"
                initial={{ top: '0%', opacity: 0 }}
                animate={{ top: ['0%', '100%', '0%'], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual QR image */}
      <motion.div
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: revealed ? 1 : 0, filter: revealed ? 'blur(0px)' : 'blur(8px)' }}
        transition={{ duration: 0.6 }}
        className="p-3 bg-cream rounded-panel"
      >
        <img
          src={`/api/qr/${username}`}
          alt="QR Code"
          width={128}
          height={128}
          className="w-32 h-32"
        />
      </motion.div>
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ draft, username }: { draft: Draft; username: string }) {
  const router = useRouter()
  const [views, setViews]                   = useState(0)
  const [leads, setLeads]                   = useState(0)
  const [notification, setNotification]     = useState<Viewer | null>(null)
  const [showWallet, setShowWallet]         = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [cardVisible, setCardVisible]       = useState(false)
  const [statsVisible, setStatsVisible]     = useState(false)
  const [actionsVisible, setActionsVisible] = useState(false)
  const viewerIdx                           = useRef(0)
  const cardUrl                             = `oryn.io/${username}`

  // Cascade entrance
  useEffect(() => {
    setTimeout(() => setCardVisible(true),   200)
    setTimeout(() => setStatsVisible(true),  900)
    setTimeout(() => setActionsVisible(true), 1300)
  }, [])

  // Fake view counter
  useEffect(() => {
    const schedule = [3000, 7000, 13000, 22000]
    const timers = schedule.map(ms =>
      setTimeout(() => setViews(v => v + 1), ms)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // Fake lead counter
  useEffect(() => {
    const t = setTimeout(() => setLeads(1), 18000)
    return () => clearTimeout(t)
  }, [])

  // Fake viewer notifications
  const fireNotification = useCallback(() => {
    const viewer = FAKE_VIEWERS[viewerIdx.current % FAKE_VIEWERS.length]
    viewerIdx.current++
    setNotification(viewer)
  }, [])

  useEffect(() => {
    const schedule = [4000, 9500, 17000, 28000]
    const timers = schedule.map(ms => setTimeout(fireNotification, ms))
    return () => timers.forEach(clearTimeout)
  }, [fireNotification])

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${cardUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-obsidian flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gold/3 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-olive/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center pt-16 pb-24 px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14 space-y-3"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="w-12 h-12 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto mb-5"
          >
            <Check size={20} className="text-gold" />
          </motion.div>
          <h1 className="font-display text-4xl md:text-5xl text-cream">
            Your identity is live.
          </h1>
          <p className="text-cream/40 text-sm">
            You're now part of the ORYN network.
          </p>
        </motion.div>

        {/* Card — center stage */}
        <AnimatePresence>
          {cardVisible && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-8 w-full max-w-[400px]"
            >
              {/* Glow */}
              <motion.div
                className="absolute -inset-4 rounded-[28px] pointer-events-none"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(201,168,76,0.1)',
                    '0 0 50px rgba(201,168,76,0.25)',
                    '0 0 20px rgba(201,168,76,0.1)',
                  ],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <BusinessCard profile={draft} size="full" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL + share */}
        <AnimatePresence>
          {cardVisible && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex items-center gap-2 mb-12 w-full max-w-[400px]"
            >
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-chip bg-obsidian-raised border border-obsidian-border text-sm overflow-hidden">
                <span className="text-gold/60 text-xs">oryn.io/</span>
                <span className="text-cream/70 truncate">{username}</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-3 rounded-chip bg-obsidian-raised border border-obsidian-border text-cream/40 hover:text-gold hover:border-gold/20 transition-all"
              >
                {copied ? <Check size={16} className="text-gold" /> : <Copy size={16} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live analytics strip */}
        <AnimatePresence>
          {statsVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[400px] mb-10"
            >
              <p className="text-xs text-cream/30 uppercase tracking-widest mb-4 text-center">Live Activity</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Eye,   label: 'Views',   value: views  },
                  { icon: Users, label: 'Leads',   value: leads  },
                  { icon: Zap,   label: 'Live',    value: '●',  isLive: true },
                ].map(({ icon: Icon, label, value, isLive }) => (
                  <div key={label}
                    className="flex flex-col items-center gap-2 p-4 rounded-panel bg-obsidian-card border border-obsidian-border"
                  >
                    <Icon size={14} className="text-gold/60" />
                    <div className="h-10 flex items-center justify-center">
                      {isLive ? (
                        <motion.span
                          className="text-2xl text-green-400"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        >
                          {value}
                        </motion.span>
                      ) : (
                        <AnimatedCount value={value as number} />
                      )}
                    </div>
                    <p className="text-xs text-cream/30 tracking-wider uppercase">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code */}
        <AnimatePresence>
          {actionsVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-[400px] mb-8 space-y-5"
            >
              <p className="text-xs text-cream/30 uppercase tracking-widest text-center">Your QR</p>
              <div className="flex justify-center">
                <QRReveal username={username} />
              </div>

              <p className="text-xs text-cream/30 text-center">
                Share this code — anyone who scans it lands on your card.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet + actions */}
        <AnimatePresence>
          {actionsVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="w-full max-w-[400px] space-y-3"
            >
              {/* Apple Wallet CTA */}
              <motion.button
                onClick={() => setShowWallet(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                animate={{ boxShadow: ['0 0 0 0 rgba(201,168,76,0)', '0 0 0 8px rgba(201,168,76,0.1)', '0 0 0 0 rgba(201,168,76,0)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-panel font-medium text-obsidian"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #F5E6A3 100%)',
                  boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
                }}
              >
                <Wallet size={18} />
                Add to Apple Wallet
              </motion.button>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-panel text-sm text-cream/60 hover:text-cream border border-obsidian-border hover:border-gold/20 transition-all"
              >
                Go to Dashboard <ChevronRight size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Viewer notifications — bottom right */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {notification && (
            <ViewerToast
              key={notification.name + Date.now()}
              viewer={notification}
              onDismiss={() => setNotification(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Apple Wallet modal */}
      <AnimatePresence>
        {showWallet && (
          <WalletModal draft={draft} onClose={() => setShowWallet(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Live card preview panel ──────────────────────────────────────────────────

function CardPreviewPanel({ draft, stepIndex }: { draft: Draft; stepIndex: number }) {
  const cardKey = `${draft.full_name}|${draft.title}|${draft.company}|${draft.email}`

  return (
    <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative">
      {/* Background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-gold/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[380px]">
        <motion.div
          key={cardKey}
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <BusinessCard profile={draft} size="full" />

          {/* Pulse on update */}
          <motion.div
            key={`glow-${cardKey}`}
            className="absolute -inset-3 rounded-[28px] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.8 }}
            style={{ boxShadow: '0 0 40px 8px rgba(201,168,76,0.2)' }}
          />
        </motion.div>

        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-2 mt-10">
          {STEP_ORDER.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full bg-obsidian-border"
              animate={{
                width: i === stepIndex ? 24 : 6,
                height: 6,
                backgroundColor: i <= stepIndex ? 'rgba(201,168,76,0.7)' : 'rgba(44,44,46,0.8)',
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Placeholder prompt */}
        {!draft.full_name && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-cream/20 mt-6 tracking-wider"
          >
            Your card will appear here
          </motion.p>
        )}
      </div>
    </div>
  )
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

const BLANK: Draft = {
  full_name: '', title: '', company: '',
  email: '',    phone: '', website: '',
  linkedin_url: '', twitter_url: '', card_style: 'noir',
}

export function OnboardingFlow() {
  const [step, setStep]       = useState<FlowStep>('identity')
  const [draft, setDraft]     = useState<Draft>(BLANK)
  const [username]            = useState(() => slugify(draft.full_name || 'oryn'))
  const [finalUser, setFinalUser] = useState('')

  const stepIndex = STEP_ORDER.indexOf(step as InputStep)

  const goNext = useCallback(() => {
    if (step === 'identity') return setStep('role')
    if (step === 'role')     return setStep('contact')
    if (step === 'contact')  return setStep('social')
    if (step === 'social') {
      setFinalUser(slugify(draft.full_name))
      return setStep('generating')
    }
  }, [step, draft.full_name])

  const progressPct = stepIndex >= 0
    ? ((stepIndex + 1) / STEP_ORDER.length) * 100
    : step === 'generating' || step === 'success' ? 100 : 0

  // Full-screen overlays for generating + success
  if (step === 'generating') {
    return (
      <AnimatePresence>
        <GeneratingScreen
          draft={draft}
          onDone={() => setStep('success')}
        />
      </AnimatePresence>
    )
  }

  if (step === 'success') {
    return <SuccessScreen draft={draft} username={finalUser || slugify(draft.full_name)} />
  }

  return (
    <div className="min-h-screen bg-obsidian flex flex-col">
      {/* Gold progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-obsidian-border z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-gold/60 via-gold to-gold-shine origin-left"
          animate={{ scaleX: progressPct / 100 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'left center' }}
        />
      </div>

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 md:px-12 pt-7 pb-4 shrink-0">
        <span className="font-display text-base tracking-[0.25em] gold-text">ORYN</span>
        {step === 'social' && (
          <button onClick={goNext}
            className="text-xs text-cream/30 hover:text-cream/60 transition-colors flex items-center gap-1"
          >
            Skip <ChevronRight size={12} />
          </button>
        )}
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — form */}
        <div className="flex flex-col justify-center w-full lg:w-1/2 xl:w-[55%] px-8 md:px-16 xl:px-24 py-12">
          <AnimatePresence mode="wait">
            {step === 'identity' && (
              <IdentityStep key="identity" draft={draft} setDraft={setDraft} onNext={goNext} />
            )}
            {step === 'role' && (
              <RoleStep key="role" draft={draft} setDraft={setDraft} onNext={goNext} />
            )}
            {step === 'contact' && (
              <ContactStep key="contact" draft={draft} setDraft={setDraft} onNext={goNext} />
            )}
            {step === 'social' && (
              <SocialStep key="social" draft={draft} setDraft={setDraft} onNext={goNext} />
            )}
          </AnimatePresence>
        </div>

        {/* Right — live card preview */}
        <div className="hidden lg:flex w-1/2 xl:w-[45%] bg-obsidian-soft/30 border-l border-obsidian-border/30">
          <CardPreviewPanel draft={draft} stepIndex={stepIndex} />
        </div>
      </div>

      {/* Mobile card preview — bottom strip */}
      {draft.full_name && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-obsidian-soft/95 border-t border-obsidian-border/50 backdrop-blur-md"
        >
          <BusinessCard profile={draft} size="full" />
        </motion.div>
      )}
    </div>
  )
}
