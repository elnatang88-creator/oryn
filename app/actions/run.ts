import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { AppError } from '@/lib/server/errors'
import type { ActionState } from './types'

/** Every action goes through here: user-safe errors out, internal errors logged, redirects passed through. */
export async function run(fn: () => Promise<string | void | ActionState>): Promise<ActionState> {
  try {
    const r = await fn()
    if (typeof r === 'object' && r) return r
    return { ok: r || 'Saved.' }
  } catch (e) {
    unstable_rethrow(e)
    if (e instanceof AppError) return { error: e.message, gate: e.code === 'plan' }
    console.error('[action]', e)
    return { error: 'Something went wrong on our side. Please try again.' }
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '')
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true'
