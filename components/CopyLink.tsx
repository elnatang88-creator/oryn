'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyLink({ url, className = 'btn min-h-[52px] w-full rounded-2xl bg-soft-100 text-navy-900' }: { url: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className={className} data-testid="copy-link"
      onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* blocked */ } }}>
      {done ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />} {done ? 'Copied' : 'Copy link'}
    </button>
  )
}
