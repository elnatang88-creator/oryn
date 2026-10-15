import { BRAND, BRAND_IS_DEFAULT } from '@/lib/brand'

/**
 * The logo: the founders' symbol plus the wordmark. With the default name the cached SVG artwork is used;
 * with a configured name (e.g. ORIAN) the symbol is paired with a text wordmark in the same proportions.
 */
const RATIO = 1158 / 299

export function Logo({ className = '', tone = 'navy', height = 26 }: { className?: string; tone?: 'navy' | 'white'; height?: number }) {
  if (BRAND_IS_DEFAULT) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tone === 'white' ? '/brand/oryn-logo-white.svg' : '/brand/oryn-logo.svg'} alt={BRAND} width={Math.round(height * RATIO)} height={height} className={`block ${className}`} style={{ height, width: 'auto' }} />
    )
  }
  return (
    <span className={`inline-flex items-center gap-[0.32em] ${className}`} style={{ height }} role="img" aria-label={BRAND}>
      <LogoMark size={height} />
      <span className={`font-bold tracking-[0.14em] ${tone === 'white' ? 'text-white' : 'text-navy-900'}`} style={{ fontSize: height * 0.82, lineHeight: 1 }}>{BRAND}</span>
    </span>
  )
}

/** The symbol alone, for tight spaces (card footer, icons). */
export function LogoMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/oryn-mark.svg" alt="" aria-hidden="true" width={size} height={size} className={`inline-block ${className}`} />
}
