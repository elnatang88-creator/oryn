/**
 * ORYN's own glyphs. The Share glyph is two identity cards passing each other — the exchange — with the
 * ORYN hexagon on the front card. Deliberately not a QR code, a wallet, a payment card or contactless waves.
 */
export function ExchangeCardsIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8.5" y="3" width="13" height="9" rx="2.2" opacity=".55" transform="rotate(8 15 7.5)" />
      <rect x="2.5" y="9.5" width="14" height="10" rx="2.4" fill="currentColor" fillOpacity=".18" />
      <path d="M7.1 12.6 9.3 13.8v2.5l-2.2 1.2-2.2-1.2v-2.5z" strokeWidth="1.5" />
      <path d="M11.5 14.1h3M11.5 16.6h2" strokeWidth="1.5" />
    </svg>
  )
}
