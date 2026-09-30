'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Nfc, Send, WifiOff } from 'lucide-react'

/**
 * Client helpers on the active sharing screen: system share sheet, copy, NFC tag writing where the
 * browser supports it, and a light refresh so "Opened" counts update while the screen is up.
 */
export function ShareLive({ url, name, nfcAllowed, nfcOnly = false }: { url: string; name: string; nfcAllowed: boolean; nfcOnly?: boolean }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [nfc, setNfc] = useState<'unsupported' | 'ready' | 'waiting' | 'done' | 'error'>('unsupported')
  const [online, setOnline] = useState(true)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
    if ('NDEFReader' in window) setNfc('ready')
    const on = () => setOnline(navigator.onLine)
    on()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    const t = nfcOnly ? undefined : setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) router.refresh() }, 8000)
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [router, nfcOnly])

  async function share() {
    try { await navigator.share({ title: `${name} · ORYN`, url }) } catch { /* dismissed */ }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }
  async function writeTag() {
    try {
      setNfc('waiting')
      // Web NFC (Android Chrome): writes this link to an NFC tag or sticker. Not phone-to-phone.
      const reader = new (window as unknown as { NDEFReader: new () => { write: (m: unknown) => Promise<void> } }).NDEFReader()
      await reader.write({ records: [{ recordType: 'url', data: url }] })
      setNfc('done')
    } catch { setNfc('error') }
  }

  if (nfcOnly) {
    if (!nfcAllowed || nfc === 'unsupported') return null
    return (
      <button type="button" onClick={writeTag} className="btn w-full border border-white/20 text-white hover:bg-white/10" disabled={nfc === 'waiting'}>
        <Nfc className="h-5 w-5" aria-hidden="true" />
        {nfc === 'waiting' ? 'Hold a tag to your phone…' : nfc === 'done' ? 'Written to tag' : nfc === 'error' ? 'Couldn’t write — try again' : 'Write this link to an NFC tag'}
      </button>
    )
  }
  return (
    <div className="space-y-3">
      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-signal-warn" role="status">
          <WifiOff className="h-4 w-4" aria-hidden="true" /> You’re offline. The code still works — it opens when they have signal.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {canShare ? (
          <button type="button" onClick={share} className="btn-share"><Send className="h-5 w-5" aria-hidden="true" /> Send link</button>
        ) : (
          <button type="button" onClick={copy} className="btn-share">{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}</button>
        )}
        {canShare ? (
          <button type="button" onClick={copy} className="btn-more">{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}</button>
        ) : nfcAllowed && nfc !== 'unsupported' ? null : (
          <a href={url} target="_blank" rel="noopener" className="btn-more">Preview</a>
        )}
      </div>
      {nfcAllowed && nfc !== 'unsupported' && (
        <button type="button" onClick={writeTag} className="btn-more w-full" disabled={nfc === 'waiting'}>
          <Nfc className="h-5 w-5" aria-hidden="true" />
          {nfc === 'waiting' ? 'Hold a tag to your phone…' : nfc === 'done' ? 'Written to tag' : nfc === 'error' ? 'Couldn’t write — try again' : 'Write to NFC tag'}
        </button>
      )}
    </div>
  )
}
