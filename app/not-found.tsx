import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="h1 mt-8">Nothing here</h1>
      <p className="mt-2 text-ink-muted">This page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/today" className="btn-more mt-6">Go to Today</Link>
    </main>
  )
}
