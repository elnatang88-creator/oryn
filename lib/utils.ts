import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  return format(parseISO(dateString), 'MMM d, yyyy')
}

export function formatRelative(dateString: string) {
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '')
}

export function getDeviceType(ua: string): string {
  if (/mobile/i.test(ua)) return 'Mobile'
  if (/tablet|ipad/i.test(ua)) return 'Tablet'
  return 'Desktop'
}

export function getBrowser(ua: string): string {
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) return 'Chrome'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/edge/i.test(ua)) return 'Edge'
  return 'Other'
}

export const CARD_STYLES: Record<string, { label: string; bg: string; accent: string }> = {
  noir: { label: 'Noir', bg: 'from-obsidian-card via-obsidian-raised to-obsidian-card', accent: 'gold' },
  midnight: { label: 'Midnight', bg: 'from-[#0D1117] via-[#161B22] to-[#0D1117]', accent: 'gold' },
  forest: { label: 'Forest', bg: 'from-[#1A2E1A] via-[#1F3320] to-[#1A2E1A]', accent: 'gold' },
  slate: { label: 'Slate', bg: 'from-[#1A1A2E] via-[#16213E] to-[#1A1A2E]', accent: 'gold' },
}
