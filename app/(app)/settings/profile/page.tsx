import { requireUser } from '@/lib/server/request'
import { getProfile } from '@/lib/server/services/viewers'
import { profileAction } from '@/app/actions/settings'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader } from '@/components/ui'
import { INDUSTRIES } from '@/lib/industries'

export const metadata = { title: 'Your ORYN profile' }

export default async function ProfilePage() {
  const user = await requireUser()
  const p = await getProfile(user.id)
  return (
    <>
      <PageHeader title="Your ORYN profile" sub="What capsule owners see when you open their capsule while signed in." />
      <ActionForm action={profileAction} className="card space-y-4 p-5">
        <div><label className="label" htmlFor="display_name">Name</label><input dir="auto" id="display_name" name="display_name" defaultValue={p.display_name} maxLength={80} className="input" autoComplete="name" /></div>
        <div><label className="label" htmlFor="profile_headline">One line about you</label><input dir="auto" id="profile_headline" name="profile_headline" defaultValue={p.profile_headline} maxLength={90} className="input" placeholder="e.g. Product lead · Tel Aviv" /></div>
        <div>
          <label className="label" htmlFor="industry">Your field</label>
          <select id="industry" name="industry" defaultValue={p.industry ?? ''} className="input">
            <option value="">Prefer not to say</option>
            {INDUSTRIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-muted">Owners with Pro see which fields their viewers work in.</p>
        </div>
        <fieldset>
          <legend className="label">When you open someone’s capsule</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-soft-200 p-3">
              <input type="radio" name="view_visibility" value="visible" defaultChecked={p.view_visibility === 'visible'} className="mt-1" data-testid="visibility-visible" />
              <span><span className="block font-semibold">Show my profile</span><span className="block text-sm text-ink-muted">They can see your name, line and field. You see a note saying so every time.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-soft-200 p-3">
              <input type="radio" name="view_visibility" value="private" defaultChecked={p.view_visibility === 'private'} className="mt-1" data-testid="visibility-private" />
              <span><span className="block font-semibold">View privately</span><span className="block text-sm text-ink-muted">They only see that the capsule was opened. You still count as one anonymous open.</span></span>
            </label>
          </div>
        </fieldset>
        <Submit className="btn-save w-full">Save profile</Submit>
      </ActionForm>
    </>
  )
}
