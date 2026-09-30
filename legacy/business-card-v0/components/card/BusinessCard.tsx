'use client'

import { Profile } from '@/types'
import { cn, stripProtocol, getInitials, CARD_STYLES } from '@/lib/utils'
import { Globe, Mail, Phone, Linkedin, Twitter, Instagram, Wifi } from 'lucide-react'

interface BusinessCardProps {
  profile: Partial<Profile>
  size?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

export function BusinessCard({ profile, size = 'md', className }: BusinessCardProps) {
  const style = CARD_STYLES[profile.card_style ?? 'noir']

  return (
    <div
      className={cn(
        'oryn-card card-aspect relative select-none',
        size === 'sm' && 'max-w-[220px]',
        size === 'md' && 'max-w-[340px]',
        size === 'lg' && 'max-w-[420px]',
        size === 'full' && 'w-full',
        className
      )}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-card pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-gold/4 blur-3xl rounded-full" />
      </div>

      <div className="relative h-full flex flex-col justify-between p-[7%]">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <span
            className="font-display tracking-[0.3em] text-gold"
            style={{ fontSize: size === 'sm' ? '0.55rem' : size === 'lg' || size === 'full' ? '0.8rem' : '0.65rem' }}
          >
            ORYN
          </span>

          {/* NFC icon */}
          <Wifi
            className="text-cream/20 rotate-90"
            style={{ width: size === 'sm' ? 12 : 16, height: size === 'sm' ? 12 : 16 }}
          />
        </div>

        {/* Name block */}
        <div className="space-y-0.5">
          <h3
            className="gold-text font-display font-semibold leading-tight tracking-wide"
            style={{ fontSize: size === 'sm' ? '0.75rem' : size === 'lg' || size === 'full' ? '1.35rem' : '1rem' }}
          >
            {profile.full_name || 'Your Name'}
          </h3>

          {profile.title && (
            <p
              className="text-cream/70 tracking-wider"
              style={{ fontSize: size === 'sm' ? '0.45rem' : size === 'lg' || size === 'full' ? '0.7rem' : '0.55rem' }}
            >
              {profile.title}
            </p>
          )}

          {profile.company && (
            <p
              className="text-cream/40 uppercase tracking-widest"
              style={{ fontSize: size === 'sm' ? '0.38rem' : size === 'lg' || size === 'full' ? '0.58rem' : '0.45rem' }}
            >
              {profile.company}
            </p>
          )}
        </div>

        {/* Contact row */}
        <div className="space-y-1">
          {profile.email && (
            <div className="flex items-center gap-1.5 text-cream/50">
              <Mail style={{ width: size === 'sm' ? 7 : 9, height: size === 'sm' ? 7 : 9 }} className="text-gold/50 shrink-0" />
              <span style={{ fontSize: size === 'sm' ? '0.38rem' : size === 'lg' || size === 'full' ? '0.6rem' : '0.48rem' }}>
                {profile.email}
              </span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-1.5 text-cream/50">
              <Phone style={{ width: size === 'sm' ? 7 : 9, height: size === 'sm' ? 7 : 9 }} className="text-gold/50 shrink-0" />
              <span style={{ fontSize: size === 'sm' ? '0.38rem' : size === 'lg' || size === 'full' ? '0.6rem' : '0.48rem' }}>
                {profile.phone}
              </span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-1.5 text-cream/50">
              <Globe style={{ width: size === 'sm' ? 7 : 9, height: size === 'sm' ? 7 : 9 }} className="text-gold/50 shrink-0" />
              <span style={{ fontSize: size === 'sm' ? '0.38rem' : size === 'lg' || size === 'full' ? '0.6rem' : '0.48rem' }}>
                {stripProtocol(profile.website)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom gold line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </div>
  )
}
