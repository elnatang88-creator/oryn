/** Single source for the ORYN mark. Swap /public/brand/oryn-wordmark.svg for the supplied logo asset. */
export function Logo({ className = '', tone = 'navy' }: { className?: string; tone?: 'navy' | 'white' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${tone === 'white' ? 'text-white' : 'text-navy-900'} ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="#4D84FF" strokeWidth="3.2" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-extrabold tracking-[0.28em]">ORYN</span>
    </span>
  )
}
