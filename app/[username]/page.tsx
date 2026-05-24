import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BusinessCard } from '@/components/card/BusinessCard'
import { LeadCapture } from '@/components/leads/LeadCapture'
import { Profile } from '@/types'
import { headers } from 'next/headers'
import { getDeviceType, getBrowser, stripProtocol } from '@/lib/utils'
import {
  Globe, Mail, Phone, Linkedin, Twitter, Instagram,
  QrCode, Wallet, ArrowUpRight
} from 'lucide-react'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles').select('full_name,title,company').eq('username', username).single()

  if (!profile) return { title: 'Card Not Found' }
  return {
    title: `${profile.full_name} — ORYN`,
    description: [profile.title, profile.company].filter(Boolean).join(' at '),
  }
}

async function trackView(profileId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const referrer = headersList.get('referer') ?? null

  await supabase.from('card_views').insert({
    profile_id: profileId,
    viewer_ip: ip,
    viewer_device: getDeviceType(ua),
    viewer_browser: getBrowser(ua),
    referrer,
  })
}

export default async function PublicCardPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single()

  if (!profile) notFound()

  // Track view (fire-and-forget)
  trackView(profile.id, supabase).catch(() => {})

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cardUrl = `${appUrl}/${username}`

  const socials = [
    { href: profile.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { href: profile.twitter_url, icon: Twitter, label: 'Twitter' },
    { href: profile.instagram_url, icon: Instagram, label: 'Instagram' },
  ].filter((s) => s.href)

  return (
    <div className="min-h-screen bg-obsidian bg-hero-radial">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-50" />

      {/* Top bar */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <span className="font-display text-base tracking-[0.25em] gold-text">ORYN</span>
        <a href="/signup" className="text-xs text-cream/30 hover:text-cream/50 transition-colors">
          Get your card
        </a>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-lg mx-auto px-6 pb-20 pt-4">
        {/* Card */}
        <div className="flex justify-center mb-8">
          <div className="w-full animate-slide-up">
            <BusinessCard profile={profile as Profile} size="full" />
          </div>
        </div>

        {/* Name + bio */}
        <div className="text-center space-y-2 mb-8 animate-slide-up">
          <h1 className="font-display text-2xl text-cream">{profile.full_name}</h1>
          {profile.title && (
            <p className="text-cream/50">
              {profile.title}{profile.company ? ` · ${profile.company}` : ''}
            </p>
          )}
          {profile.bio && (
            <p className="text-sm text-cream/40 leading-relaxed max-w-sm mx-auto mt-3">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Contact actions */}
        <div className="space-y-2 mb-6">
          {profile.email && (
            <a href={`mailto:${profile.email}`}
              className="flex items-center gap-3 px-5 py-3.5 rounded-panel bg-obsidian-card border border-obsidian-border hover:border-gold/20 transition-all group"
            >
              <div className="w-8 h-8 rounded-md bg-gold/8 border border-gold/15 flex items-center justify-center">
                <Mail size={14} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-cream/40">Email</p>
                <p className="text-sm text-cream/80">{profile.email}</p>
              </div>
              <ArrowUpRight size={14} className="text-cream/20 group-hover:text-gold/50 transition-colors" />
            </a>
          )}

          {profile.phone && (
            <a href={`tel:${profile.phone}`}
              className="flex items-center gap-3 px-5 py-3.5 rounded-panel bg-obsidian-card border border-obsidian-border hover:border-gold/20 transition-all group"
            >
              <div className="w-8 h-8 rounded-md bg-gold/8 border border-gold/15 flex items-center justify-center">
                <Phone size={14} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-cream/40">Phone</p>
                <p className="text-sm text-cream/80">{profile.phone}</p>
              </div>
              <ArrowUpRight size={14} className="text-cream/20 group-hover:text-gold/50 transition-colors" />
            </a>
          )}

          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3.5 rounded-panel bg-obsidian-card border border-obsidian-border hover:border-gold/20 transition-all group"
            >
              <div className="w-8 h-8 rounded-md bg-gold/8 border border-gold/15 flex items-center justify-center">
                <Globe size={14} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-cream/40">Website</p>
                <p className="text-sm text-cream/80">{stripProtocol(profile.website)}</p>
              </div>
              <ArrowUpRight size={14} className="text-cream/20 group-hover:text-gold/50 transition-colors" />
            </a>
          )}
        </div>

        {/* Social links */}
        {socials.length > 0 && (
          <div className="flex gap-3 mb-8">
            {socials.map(({ href, icon: Icon, label }) => (
              <a key={label} href={href!} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-panel bg-obsidian-card border border-obsidian-border hover:border-gold/20 text-cream/40 hover:text-cream/70 transition-all text-sm"
              >
                <Icon size={14} /> {label}
              </a>
            ))}
          </div>
        )}

        {/* Wallet + QR */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <a href={`/api/wallet/apple?id=${profile.id}`}
            className="flex items-center justify-center gap-2 py-3 rounded-panel border border-obsidian-border bg-obsidian-card hover:border-gold/20 text-cream/50 hover:text-cream/80 text-sm transition-all"
          >
            <Wallet size={14} /> Apple Wallet
          </a>
          <a href={`/api/wallet/google?id=${profile.id}`}
            className="flex items-center justify-center gap-2 py-3 rounded-panel border border-obsidian-border bg-obsidian-card hover:border-gold/20 text-cream/50 hover:text-cream/80 text-sm transition-all"
          >
            <Wallet size={14} /> Google Wallet
          </a>
        </div>

        {/* QR code */}
        <div className="mb-8 p-5 rounded-panel bg-obsidian-card border border-obsidian-border space-y-3">
          <div className="flex items-center gap-2 text-xs text-cream/40">
            <QrCode size={12} /> Scan to save contact
          </div>
          <div className="flex justify-center bg-cream rounded-panel p-4">
            <img src={`/api/qr/${username}`} alt="QR code" className="w-32 h-32" />
          </div>
        </div>

        {/* Lead capture */}
        <div className="rounded-panel bg-obsidian-card border border-obsidian-border p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg text-cream">Connect</h2>
            <p className="text-sm text-cream/40 mt-1">Leave your details and start a conversation.</p>
          </div>
          <LeadCapture profileId={profile.id} username={username} />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-cream/20 mt-10">
          Powered by{' '}
          <a href="/signup" className="text-gold/40 hover:text-gold transition-colors">ORYN</a>
        </p>
      </main>
    </div>
  )
}
