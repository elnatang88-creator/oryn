'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-chip transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          {
            'btn-primary': variant === 'primary',
            'btn-secondary': variant === 'secondary',
            'btn-ghost': variant === 'ghost',
            'bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50': variant === 'danger',
          },
          {
            'px-3 py-2 text-xs': size === 'sm',
            'px-5 py-2.5 text-sm': size === 'md',
            'px-7 py-3.5 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
