'use client'

import { useEffect, type ReactNode } from 'react'

/** A native-feeling bottom sheet: slides up, dims the page, closes on the backdrop, Escape or the handle. */
export function Sheet({ open, onClose, title, children, testId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; testId?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
      <button type="button" aria-label="Close" className="absolute inset-0 animate-[fade_.2s_ease-out_both] bg-black/55" onClick={onClose} />
      <div className="relative w-full max-w-md animate-[sheet_.32s_cubic-bezier(.2,.9,.25,1)_both] rounded-t-[1.75rem] bg-white px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3 text-ink shadow-2xl sm:rounded-[1.75rem]">
        <button type="button" onClick={onClose} className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-soft-300" aria-label="Close" />
        <h2 className="mb-4 text-lg font-bold text-navy-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
