import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata = { title: 'Privacy' }

/** Plain-language summary. The binding privacy policy and terms must be written and reviewed by counsel. */
export default function PrivacyNotice() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 text-[16px] leading-relaxed">
      <Link href="/"><Logo /></Link>
      <h1 className="h1 mt-8">How ORYN handles privacy</h1>
      <p className="mt-2 rounded-xl bg-soft-100 px-4 py-3 text-sm">Draft summary for the prototype. The formal Privacy Policy and Terms of Service are pending legal review.</p>
      <h2 className="h2 mt-8">If someone shared a capsule with you</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>You don’t need an account. You see only what they chose to share.</li>
        <li>They see a count of opens — not who you are, not your IP address, not your device.</li>
        <li>You become known to them only if you choose to send a request to connect.</li>
        <li>If you don’t want to continue, close the page. Nothing is sent.</li>
        <li>A small first-party cookie lets a “opens once” capsule stay open on your device. It carries no identity.</li>
      </ul>
      <h2 className="h2 mt-8">If you use ORYN</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>You own your content. You choose what each capsule shows and can stop any share at any time.</li>
        <li>Private notes and follow-ups are never shown to anyone else.</li>
        <li>You can download all your data and delete your account from Settings.</li>
        <li>ORYN does not sell personal data and does not use customer data to train external AI models without explicit authorization.</li>
      </ul>
    </main>
  )
}
