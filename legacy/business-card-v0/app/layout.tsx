import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'ORYN — Your Identity, Perfected', template: '%s | ORYN' },
  description: 'The luxury digital business card platform. Share your identity effortlessly with Apple Wallet, Google Wallet, and real-time analytics.',
  keywords: ['digital business card', 'NFC card', 'Apple Wallet', 'networking', 'luxury'],
  authors: [{ name: 'ORYN' }],
  openGraph: {
    title: 'ORYN — Your Identity, Perfected',
    description: 'The luxury digital business card platform.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-obsidian antialiased">{children}</body>
    </html>
  )
}
