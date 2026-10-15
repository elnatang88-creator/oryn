import 'server-only'
import { getDb, type Db } from './db'
import { AppError } from './errors'
import { audit } from './audit'
import { track } from './analytics'
import { rateLimit } from './ratelimit'

/**
 * ORYN Intelligence — a provider interface with explicit consent and a non-AI fallback.
 *
 * Nothing leaves the server unless BOTH hold: the deployment sets ORYN_AI_PROVIDER=anthropic (+ ANTHROPIC_API_KEY)
 * AND the person turned on "AI assistance" in Settings (users.ai_consent_at). Otherwise every task returns a
 * plain, template-based result and says so — never a fake "AI" answer. Only the fields named in each task are
 * sent; never private notes of other people, never emails of third parties beyond what the task needs.
 */
export type AiTask = 'bio' | 'followup' | 'lead_summary' | 'profile_tips'
export interface AiResult { text: string; source: 'ai' | 'fallback'; note?: string }

export function aiProvider(): 'anthropic' | 'none' {
  return process.env.ORYN_AI_PROVIDER === 'anthropic' && process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'
}

const PROMPTS: Record<AiTask, string> = {
  bio: 'Write a professional bio of at most 60 words in the first person, warm and concrete, no hype words, no emojis. Use only the facts given; do not invent employers, degrees or numbers.',
  followup: 'Draft a short follow-up message (at most 90 words) from the sender to the person, referencing where they met and the context. Friendly, specific, one clear next step. No subject line, no placeholders in brackets.',
  lead_summary: 'Summarize this sales lead in 3 short bullet points for a teammate: who they are, what they want, the suggested next step. Use only the facts given.',
  profile_tips: 'Give 3 short, practical suggestions (one line each) to improve this professional card so it reads clearly and invites contact. Be specific to the facts given.',
}

/** The non-AI path. Honest, useful, and always available. */
function fallback(task: AiTask, f: Record<string, string>): AiResult {
  const first = (f.name ?? '').split(' ')[0] || 'there'
  const note = 'Written from your details without AI (turn on AI assistance in Settings, and the server must have a provider configured).'
  switch (task) {
    case 'bio':
      return { source: 'fallback', note, text: [f.name && f.role ? `${f.name} is ${/^[aeiou]/i.test(f.role) ? 'an' : 'a'} ${f.role}${f.company ? ` at ${f.company}` : ''}.` : f.name ? `${f.name}.` : '', f.industry ? `Working in ${f.industry.toLowerCase()}.` : '', f.interests ? `Interested in ${f.interests}.` : '', 'Happy to connect.'].filter(Boolean).join(' ') }
    case 'followup':
      return { source: 'fallback', note, text: `Hi ${first}, good to meet you${f.where ? ` at ${f.where}` : ''}.${f.context ? ` ${f.context}` : ''} Would you be open to a short call next week to continue the conversation? — ${f.sender ?? ''}`.trim() }
    case 'lead_summary':
      return { source: 'fallback', note, text: [`• ${f.name}${f.company ? `, ${f.company}` : ''}${f.source ? ` — came in via ${f.source}` : ''}`, `• Wants: ${f.message || 'not stated yet'}`, `• Next: ${f.stage === 'New' ? 'make first contact' : `continue from stage “${f.stage}”`}`].join('\n') }
    case 'profile_tips':
      return { source: 'fallback', note, text: [!f.headline ? '• Add a one-line headline (what you do, for whom).' : '• Keep the headline under 8 words.', !f.company ? '• Add your company or project so people place you.' : '• Make the company name match how people know it.', '• Keep exactly one primary action (email or booking) on the first view.'].join('\n') }
  }
}

async function callAnthropic(task: AiTask, facts: Record<string, string>): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  const res = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 1024, // deliberately short outputs
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: `You help people on ORYN, a digital identity and networking product. ${PROMPTS[task]} Reply with the text only.`,
    messages: [{ role: 'user', content: Object.entries(facts).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') }],
  })
  if (res.stop_reason === 'refusal') throw new AppError('invalid', 'The assistant declined this request.')
  return res.content.filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('').trim()
}

async function consented(db: Db, userId: string) {
  const [u] = await db.query<{ ai_consent_at: Date | null }>(`SELECT ai_consent_at FROM users WHERE id = $1`, [userId])
  return !!u?.ai_consent_at
}

/** Runs a task. Facts must already be authorized for this user by the caller. */
export async function runAi(userId: string, task: AiTask, facts: Record<string, string>): Promise<AiResult> {
  const db = await getDb()
  await rateLimit(db, `ai:${userId}`, 60, 3600)
  const useAi = aiProvider() === 'anthropic' && (await consented(db, userId))
  await audit(db, { actor: userId, action: 'ai.task', targetType: 'user', targetId: userId, meta: { task, provider: useAi ? 'anthropic' : 'fallback' } })
  await track(db, 'ai_used', { userId, props: { source: useAi ? `ai_${task}` : `fallback_${task}` } })
  if (!useAi) return fallback(task, facts)
  try {
    return { source: 'ai', text: await callAnthropic(task, facts) }
  } catch (e) {
    console.error('[ai]', (e as Error).message)
    return { ...fallback(task, facts), note: 'The AI provider was unavailable, so this was written from your details without AI.' }
  }
}

/** Gathers the facts a task may use — only data the user is allowed to see. */
export async function aiFacts(userId: string, task: AiTask, subjectId: string | null): Promise<Record<string, string>> {
  const db = await getDb()
  if (task === 'bio' || task === 'profile_tips') {
    const [u] = await db.query<{ display_name: string; profile_headline: string; industry: string | null }>(`SELECT display_name, profile_headline, industry FROM users WHERE id = $1`, [userId])
    const [c] = subjectId ? await db.query<{ display_name: string; headline: string; fields: { kind: string; value: string }[] }>(`SELECT display_name, headline, fields FROM capsules WHERE id = $1 AND owner_user_id = $2`, [subjectId, userId]) : []
    const company = c?.fields.find((f) => f.kind === 'company')?.value ?? ''
    const role = c?.fields.find((f) => f.kind === 'role')?.value ?? ''
    return { name: c?.display_name ?? u.display_name, headline: c?.headline ?? u.profile_headline, role, company, industry: u.industry ?? '' }
  }
  if (task === 'followup') {
    const [c] = await db.query<{ name: string; headline: string; met_where: string; event_name: string | null; sender: string }>(
      `SELECT c.name, c.headline, c.met_where, e.name AS event_name, u.display_name AS sender FROM connections c LEFT JOIN events e ON e.id = c.event_id JOIN users u ON u.id = c.owner_user_id WHERE c.id = $1 AND c.owner_user_id = $2`, [subjectId, userId])
    if (!c) throw new AppError('not_found', 'That connection could not be found.')
    const notes = await db.query<{ body: string }>(`SELECT body FROM private_notes WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC LIMIT 3`, [subjectId, userId])
    return { name: c.name, role: c.headline, where: c.event_name ?? c.met_where, context: notes.map((n) => n.body).join(' '), sender: c.sender }
  }
  // lead_summary
  const { getLead } = await import('./services/crm')
  const { lead, notes } = await getLead(userId, subjectId ?? '')
  return { name: lead.name, company: lead.company, source: lead.source, stage: lead.stage, message: [lead.message, ...notes.slice(0, 3).map((n) => n.body)].filter(Boolean).join(' ') }
}
