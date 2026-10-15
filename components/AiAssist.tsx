'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, Sparkles } from 'lucide-react'
import type { AiTask } from '@/lib/server/ai'

/** "Write it for me" — shows the result and, honestly, whether it came from AI or from a template. */
export function AiAssist({ kind, subjectId, label }: { kind: AiTask; subjectId?: string | null; label: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [out, setOut] = useState<{ text: string; source: 'ai' | 'fallback'; note?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  async function go() {
    setState('busy')
    try {
      const r = await fetch('/api/v1/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: kind, subjectId }) })
      const j = await r.json()
      if (!r.ok || !j.data?.text) throw new Error(j?.error?.message ?? 'failed')
      setOut(j.data); setState('done')
    } catch { setState('error') }
  }
  return (
    <div className="card mt-4 p-4" data-testid={`ai-${kind}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-electric" aria-hidden="true" /> {label}</p>
        <button type="button" onClick={go} disabled={state === 'busy'} className="btn-more min-h-[40px] text-sm" data-testid="ai-run">{state === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {state === 'done' ? 'Again' : 'Write it'}</button>
      </div>
      {state === 'error' && <p role="alert" className="mt-2 text-sm text-signal-stop">Couldn’t write that right now.</p>}
      {out && (
        <div className="mt-3">
          <p dir="auto" className="whitespace-pre-wrap rounded-xl bg-soft-50 px-3 py-2 text-[15px]" data-testid="ai-text">{out.text}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
            <span data-testid="ai-source">{out.source === 'ai' ? 'Written with AI from your details.' : out.note ?? 'Written from your details, without AI.'}</span>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(out.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* blocked */ } }} className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-electric-600">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
