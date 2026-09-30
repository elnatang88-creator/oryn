import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'olive' | 'muted' | 'red' | 'green'
  className?: string
}

export function Badge({ children, variant = 'muted', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide',
        {
          'bg-gold/10 text-gold border border-gold/20': variant === 'gold',
          'bg-olive/20 text-olive-subtle border border-olive/30': variant === 'olive',
          'bg-obsidian-raised text-cream/50 border border-obsidian-border': variant === 'muted',
          'bg-red-900/20 text-red-400 border border-red-700/30': variant === 'red',
          'bg-green-900/20 text-green-400 border border-green-700/30': variant === 'green',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
