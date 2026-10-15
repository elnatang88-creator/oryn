/** Human date range in the event's own timezone. */
export function fmtWhen(start: Date | string | null, end: Date | string | null, tz: string) {
  if (!start) return null
  const s0 = new Date(start), e0 = end ? new Date(end) : null
  try {
    const f = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: tz })
    const s = f.format(s0)
    if (!e0) return s
    const sameDay = s0.toDateString() === e0.toDateString()
    return sameDay ? `${s} – ${new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: tz }).format(e0)}` : `${s} → ${f.format(e0)}`
  } catch { return s0.toUTCString() }
}
