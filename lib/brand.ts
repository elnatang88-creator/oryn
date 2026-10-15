/**
 * Brand through configuration. The codebase is ORYN; the product can present as ORIAN (or anything) by
 * setting NEXT_PUBLIC_BRAND_NAME at build time. Nothing else is renamed.
 */
export const BRAND = (process.env.NEXT_PUBLIC_BRAND_NAME || 'ORYN').trim().slice(0, 24)
export const BRAND_TAGLINE = process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Your card. Your rules.'
/** True when the built-in ORYN wordmark artwork applies; any other name uses the symbol + text wordmark. */
export const BRAND_IS_DEFAULT = BRAND.toUpperCase() === 'ORYN'
