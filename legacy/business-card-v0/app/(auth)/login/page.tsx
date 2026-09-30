'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm space-y-8 animate-slide-up">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-semibold text-cream">Welcome back</h1>
        <p className="text-sm text-cream/40">Sign in to your ORYN account</p>
      </div>

      <div className="stat-card space-y-6 border border-obsidian-border/80">
        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-cream/50 tracking-wider uppercase">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-chip bg-red-900/20 border border-red-700/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign In <ArrowRight size={16} />
          </Button>
        </form>

        <div className="section-divider" />

        <p className="text-center text-sm text-cream/40">
          No account?{' '}
          <Link href="/signup" className="text-gold hover:text-gold-light transition-colors">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />}>
      <LoginForm />
    </Suspense>
  )
}
