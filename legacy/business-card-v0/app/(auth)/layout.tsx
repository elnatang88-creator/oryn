import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-5">
        <Link href="/" className="font-display text-lg tracking-[0.25em] gold-text">
          ORYN
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-olive/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/4 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
