'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Mail, MessageCircle, MessageSquareText, QrCode, Share2 } from 'lucide-react'
import { Sheet } from './Sheet'
import { trackClient } from '@/lib/track-client'

/**
 * Every way here is real: the system share sheet (which is where iPhone offers AirDrop), copy, the standard
 * sms:/mailto: links and WhatsApp's public share URL, and the QR mode. Nothing is shown that the device can't do.
 */
export function ShareAnotherWay({ url, name, qrHref }: { url: string; name: string; qrHref: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => setCanShare(typeof navigator.share === 'function'), [])
  const text = `${name} · ORYN card`
  const used = (channel: string) => trackClient('share_method_used', { channel, surface: 'share' })
  async function copy() {
    used('copy')
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }
  async function system() {
    used('system')
    try { await navigator.share({ title: text, url }) } catch { /* dismissed */ }
  }
  const row = 'flex min-h-[56px] w-full items-center gap-4 rounded-2xl px-3 text-start text-[16px] font-semibold hover:bg-soft-50'
  const icon = 'grid h-10 w-10 place-items-center rounded-xl bg-soft-100 text-electric-600'
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); trackClient('share_sheet_opened', { surface: 'share' }) }} className="btn w-full text-[15px] text-soft-200 hover:bg-white/10" data-testid="share-another-way">
        <Share2 className="h-5 w-5" aria-hidden="true" /> Share another way
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Share another way" testId="share-sheet">
        <div className="space-y-1">
          {canShare && <button type="button" onClick={system} className={row} data-testid="share-system"><span className={icon}><Share2 className="h-5 w-5" /></span><span>More options<span className="block text-sm font-normal text-ink-muted">Your phone’s share sheet, including AirDrop on iPhone</span></span></button>}
          <button type="button" onClick={copy} className={row} data-testid="share-copy"><span className={icon}>{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</span>{copied ? 'Link copied' : 'Copy ORYN link'}</button>
          <a href={`sms:?&body=${encodeURIComponent(url)}`} onClick={() => used('sms')} className={row}><span className={icon}><MessageSquareText className="h-5 w-5" /></span>Messages</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => used('whatsapp')} className={row}><span className={icon}><MessageCircle className="h-5 w-5" /></span>WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`} onClick={() => used('email')} className={row}><span className={icon}><Mail className="h-5 w-5" /></span>Email</a>
          <Link href={qrHref} className={row} data-testid="share-sheet-qr"><span className={icon}><QrCode className="h-5 w-5" /></span>Show QR code</Link>
        </div>
        <p className="mt-3 break-all rounded-xl bg-soft-50 px-3 py-2 text-xs text-ink-muted" data-testid="share-sheet-url">{url}</p>
        <p className="mt-2 text-xs text-ink-muted">Anyone with this link sees only what you chose, and never needs the app.</p>
      </Sheet>
    </>
  )
}
