'use client'

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/app/actions/types'

const PendingContext = createContext<boolean | null>(null)

/**
 * Progressive-enhancement form. Without JS it posts to the server action like any HTML form.
 * With JS it submits in a transition, which (unlike a plain `action` prop in React 19) does NOT clear
 * the fields — so a failed submission keeps what the person typed. Clearing happens only on success
 * when `resetOnSuccess` is set.
 */
export function ActionForm({
  action, children, className = '', resetOnSuccess = false, id,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  children: ReactNode
  className?: string
  resetOnSuccess?: boolean
  id?: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const fd = new FormData(e.currentTarget, submitter)
    startTransition(() => formAction(fd))
  }
  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} action={formAction} onSubmit={onSubmit} className={className} id={id} noValidate>
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
    </PendingContext.Provider>
  )
}

export function Submit({ children, className = 'btn-share w-full', pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const status = useFormStatus()
  const ctx = useContext(PendingContext)
  const pending = ctx ?? status.pending
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? 'One moment…' : children}
    </button>
  )
}
