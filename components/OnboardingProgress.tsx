import { Check } from 'lucide-react'

export const ONBOARDING_STEPS = ['Identity', 'Profile type', 'Your card', 'Appearance', 'Share'] as const

/** Five short steps, always visible during the first run. Optional steps can be skipped; the bar says where you are. */
export function OnboardingProgress({ step, tone = 'light' }: { step: 1 | 2 | 3 | 4 | 5; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <ol className="mb-5 flex items-center gap-1.5" aria-label={`Step ${step} of ${ONBOARDING_STEPS.length}: ${ONBOARDING_STEPS[step - 1]}`} data-testid="onboarding-progress" data-step={step}>
      {ONBOARDING_STEPS.map((label, i) => {
        const n = i + 1, done = n < step, now = n === step
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span className={`h-1.5 rounded-full transition-colors ${done || now ? 'bg-electric' : dark ? 'bg-white/15' : 'bg-soft-200'}`} />
            <span className={`hidden text-[11px] font-semibold sm:block ${now ? (dark ? 'text-white' : 'text-navy-900') : dark ? 'text-soft-300' : 'text-ink-muted'}`}>{done ? <Check className="mr-0.5 inline h-3 w-3" aria-hidden="true" /> : null}{label}</span>
          </li>
        )
      })}
      <li className={`ml-2 shrink-0 text-xs font-semibold ${dark ? 'text-soft-200' : 'text-ink-muted'}`}>{step}/{ONBOARDING_STEPS.length}</li>
    </ol>
  )
}
