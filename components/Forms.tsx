'use client'

import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/app/actions/types'

/** Progressive-enhancement form: works without JS (server action), shows pending + plain-language errors with JS. */
export function ActionForm({
  action, children, className = '', resetOnSuccess = false, id,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  children: ReactNode
  className?: string
  resetOnSuccess?: boolean
  id?: string
}) {
  const [state, formAction] = useActionState(action, {})
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  return (
    <form ref={ref} action={formAction} className={className} id={id} noValidate>
      {children}
      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop">
            {state.error} {state.gate && <a href="/settings/plan" className="underline">See plans</a>}
          </p>
        )}
        {state.ok && <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-signal-ok">{state.ok}</p>}
      </div>
    </form>
  )
}

export function Submit({ children, className = 'btn-share w-full', pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? 'One moment…' : children}
    </button>
  )
}
