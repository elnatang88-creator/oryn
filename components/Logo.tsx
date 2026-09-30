/**
 * The ORYN logo: the founders' symbol plus the ORYN wordmark (public/brand/). Served as cached SVG
 * files rather than inlined, so the ~9 KB of vector data isn't repeated in every page on weak networks.
 */
const RATIO = 1158 / 299

export function Logo({ className = '', tone = 'navy', height = 26 }: { className?: string; tone?: 'navy' | 'white'; height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === 'white' ? '/brand/oryn-logo-white.svg' : '/brand/oryn-logo.svg'}
      alt="ORYN"
      width={Math.round(height * RATIO)}
      height={height}
      className={`block ${className}`}
      style={{ height, width: 'auto' }}
    />
  )
}

/** The symbol alone, for tight spaces (capsule footer, icons). */
export function LogoMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/oryn-mark.svg" alt="" aria-hidden="true" width={size} height={size} className={`inline-block ${className}`} />
}
