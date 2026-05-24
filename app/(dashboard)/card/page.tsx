'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/components/card/BusinessCard'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CARD_STYLES } from '@/lib/utils'
import { Profile, CardStyle } from '@/types'
import { Download, Share2, QrCode, Wallet, Check, Copy } from 'lucide-react'
import Image from 'next/image'

export default function CardPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (profile.username) {
      setQrUrl(`/api/qr/${profile.username}`)
    }
  }, [profile.username])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      full_name: profile.full_name,
      title: profile.title,
      company: profile.company,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      linkedin_url: profile.linkedin_url,
      twitter_url: profile.twitter_url,
      instagram_url: profile.instagram_url,
      bio: profile.bio,
      card_style: profile.card_style,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCopy = () => {
    const url = `${window.location.origin}/${profile.username}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const set = (key: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">My Card</h1>
          <p className="text-sm text-cream/40 mt-1">Design and manage your digital identity.</p>
        </div>
        <Button onClick={handleSave} loading={saving} size="md">
          {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — form */}
        <div className="space-y-6">
          {/* Identity */}
          <div className="stat-card space-y-5">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name" value={profile.full_name ?? ''} onChange={set('full_name')} placeholder="Alexandra Chen" />
              <Input label="Username" value={profile.username ?? ''} onChange={set('username')} placeholder="alexandra" hint="oryn.io/username" />
            </div>
            <Input label="Job Title" value={profile.title ?? ''} onChange={set('title')} placeholder="Managing Director" />
            <Input label="Company" value={profile.company ?? ''} onChange={set('company')} placeholder="Meridian Capital" />
            <Textarea label="Bio" value={profile.bio ?? ''} onChange={set('bio')} placeholder="A brief introduction..." />
          </div>

          {/* Contact */}
          <div className="stat-card space-y-5">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Contact</p>
            <Input label="Email" type="email" value={profile.email ?? ''} onChange={set('email')} placeholder="you@company.com" />
            <Input label="Phone" value={profile.phone ?? ''} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
            <Input label="Website" value={profile.website ?? ''} onChange={set('website')} placeholder="https://company.com" />
          </div>

          {/* Social */}
          <div className="stat-card space-y-5">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Social Links</p>
            <Input label="LinkedIn" value={profile.linkedin_url ?? ''} onChange={set('linkedin_url')} placeholder="linkedin.com/in/username" />
            <Input label="Twitter / X" value={profile.twitter_url ?? ''} onChange={set('twitter_url')} placeholder="twitter.com/username" />
            <Input label="Instagram" value={profile.instagram_url ?? ''} onChange={set('instagram_url')} placeholder="instagram.com/username" />
          </div>

          {/* Card Style */}
          <div className="stat-card space-y-4">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Card Style</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(CARD_STYLES).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setProfile((p) => ({ ...p, card_style: key as CardStyle }))}
                  className={`px-4 py-3 rounded-chip text-sm text-left transition-all duration-200 ${
                    profile.card_style === key
                      ? 'bg-gold/10 border border-gold/30 text-gold'
                      : 'bg-obsidian-raised border border-obsidian-border text-cream/50 hover:border-gold/15'
                  }`}
                >
                  {label}
                  {profile.card_style === key && <Check size={12} className="float-right mt-1" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — preview + share */}
        <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          {/* Live preview */}
          <div className="stat-card space-y-4">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Live Preview</p>
            <BusinessCard profile={profile} size="full" />
          </div>

          {/* Share options */}
          <div className="stat-card space-y-4">
            <p className="text-xs text-cream/40 uppercase tracking-wider">Share</p>

            <div className="flex items-center gap-2 p-3 rounded-chip bg-obsidian-raised border border-obsidian-border text-sm text-cream/50 overflow-hidden">
              <span className="flex-1 truncate">{`oryn.io/${profile.username}`}</span>
              <button onClick={handleCopy}
                className="shrink-0 p-1.5 hover:text-gold transition-colors"
              >
                {copied ? <Check size={14} className="text-gold" /> : <Copy size={14} />}
              </button>
            </div>

            {qrUrl && (
              <div className="flex justify-center p-4 bg-cream rounded-panel">
                <img src={qrUrl} alt="QR Code" className="w-36 h-36" />
              </div>
            )}

            <a href={qrUrl} download="oryn-qr.png"
              className="btn-secondary w-full justify-center text-sm"
            >
              <Download size={14} /> Download QR
            </a>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.open(`/api/wallet/apple?id=${profile.id}`, '_blank')}
                className="btn-secondary text-sm justify-center"
              >
                <Wallet size={14} /> Apple Wallet
              </button>
              <button
                onClick={() => window.open(`/api/wallet/google?id=${profile.id}`, '_blank')}
                className="btn-secondary text-sm justify-center"
              >
                <Wallet size={14} /> Google Wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
