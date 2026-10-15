import { api } from '@/lib/server/api'
import { aiFacts, runAi, type AiTask } from '@/lib/server/ai'

export const dynamic = 'force-dynamic'

const TASKS: AiTask[] = ['bio', 'followup', 'lead_summary', 'profile_tips']

/** POST {task, subjectId?} → {text, source: 'ai'|'fallback', note?}. Consent + provider decide the source. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  const task = String(body?.task ?? '') as AiTask
  if (!TASKS.includes(task)) return { error: 'unknown task' }
  const subjectId = typeof body?.subjectId === 'string' && /^[a-z]+_[A-Za-z0-9_-]{1,40}$/.test(body.subjectId) ? body.subjectId : null
  return runAi(userId!, task, await aiFacts(userId!, task, subjectId))
})
