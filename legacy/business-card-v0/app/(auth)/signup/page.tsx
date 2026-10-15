'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ArrowRight, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setStep('verify')
  }

  if (step === 'verify') {
    return (
      <div className="w-full max-w-sm text-center space-y-6 animate-slide-up">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto">
          <CheckCircle size={26} className="text-gold" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl text-cream">Check your email</h2>
          <p className="text-sm text-cream/50">
            We sent a confirmation link to <span className="text-cream/80">{email}</span>.
            Click it to activate your ORYN account.
          </p>
        </div>
        <Link href="/login" className="btn-secondary inline-flex text-sm">
          Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-8 animate-slide-up">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-semibold text-cream">Create your card</h1>
        <p className="text-sm text-cream/40">Join ORYN — your identity, perfected.</p>
      </div>

      <div className="stat-card space-y-6 border border-obsidian-border/80">
        <form onSubmit={handleSignup} className="space-y-5">
          <Input
            label="Full Name"
            placeholder="Alexandra Chen"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          {error && (
            <div className="px-4 py-3 rounded-chip bg-red-900/20 border border-red-700/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create Free Account <ArrowRight size={16} />
          </Button>
        </form>

        <div className="section-divider" />

        <p className="text-center text-xs text-cream/30">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>

        <p className="text-center text-sm text-cream/40">
          Already have an account?{' '}
          <Link href="/login" className="text-gold hover:text-gold-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
