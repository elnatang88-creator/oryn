'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Profile } from '@/types'
import { Check, AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      full_name: profile.full_name,
      username: profile.username,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handlePasswordChange = async () => {
    if (password.length < 8) return
    await supabase.auth.updateUser({ password })
    setPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2500)
  }

  const handleDeactivate = async () => {
    if (!confirm('Deactivate your card? Visitors will see a disabled message.')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ is_active: false }).eq('id', user.id)
    setProfile((p) => ({ ...p, is_active: false }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl text-cream">Settings</h1>
        <p className="text-sm text-cream/40 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Account */}
      <div className="stat-card space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-cream/70">Account</p>
          <Badge variant={profile.plan === 'free' ? 'muted' : 'gold'} className="capitalize">
            {profile.plan} Plan
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={profile.full_name ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
            />
            <Input
              label="Username"
              value={profile.username ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              hint="Your public card URL"
            />
          </div>
          <Input label="Email" value={profile.email ?? ''} disabled hint="Contact support to change your email." />
        </div>

        <Button onClick={handleSave} loading={saving}>
          {saved ? <><Check size={14} /> Saved</> : 'Save Account'}
        </Button>
      </div>

      {/* Password */}
      <div className="stat-card space-y-5">
        <p className="text-sm font-medium text-cream/70">Change Password</p>
        <Input
          label="New Password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button variant="secondary" onClick={handlePasswordChange} disabled={password.length < 8}>
          {passwordSaved ? <><Check size={14} /> Password Updated</> : 'Update Password'}
        </Button>
      </div>

      {/* Plan */}
      <div className="stat-card space-y-4">
        <p className="text-sm font-medium text-cream/70">Upgrade Plan</p>
        <p className="text-sm text-cream/40">
          You're on the <span className="text-cream/60 capitalize">{profile.plan}</span> plan.
          Upgrade to unlock wallet integration, advanced analytics, and lead capture.
        </p>
        <div className="flex gap-3">
          <Button size="sm">Upgrade to Pro — $12/mo</Button>
          <Button variant="secondary" size="sm">Go Elite — $49/mo</Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-panel border border-red-900/30 p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={14} />
          <span className="font-medium">Danger Zone</span>
        </div>
        <p className="text-sm text-cream/40">
          Deactivating your card hides it from public view. You can reactivate any time.
        </p>
        <Button variant="danger" size="sm" onClick={handleDeactivate} disabled={!profile.is_active}>
          {profile.is_active ? 'Deactivate Card' : 'Card Deactivated'}
        </Button>
      </div>
    </div>
  )
}
