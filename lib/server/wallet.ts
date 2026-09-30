import 'server-only'
import crypto from 'node:crypto'
import type { CardDesign } from '../card-design'

/**
 * Wallet: the ORYN card as an identity credential in Apple Wallet and Google Wallet.
 *
 * WORKING HERE: the card data contract, Apple `pass.json` (generic style — an identity/membership credential,
 * not a coupon, store card or boarding pass), the Google Wallet Generic object, and signing the Google
 * "Save to Wallet" link (RS256 JWT) once an issuer and service account are configured.
 * INTEGRATION REQUIRED: Apple pass signing (PKCS#7 detached signature with the company's Pass Type ID
 * certificate + Apple WWDR certificate) and zip packaging; the Apple web service for pass updates; creating
 * the Google issuer account and class. Until configured, the UI says so and nothing pretends to succeed.
 */

export interface WalletCardData {
  name: string
  headline: string
  company: string | null
  url: string // the public ORYN card link the pass opens (a non-expiring, revocable share)
  colors: { background: string; foreground: string; label: string }
}

// Pass colours come from the card material so the pass looks like the card.
const MATERIAL_COLORS: Record<string, { background: string; foreground: string; label: string }> = {
  obsidian: { background: '#0d0d10', foreground: '#f3e2b3', label: '#b9a57a' },
  midnight: { background: '#011441', foreground: '#eef1f4', label: '#a9b8e6' },
  pearl: { background: '#f3eee5', foreground: '#3a3020', label: '#8a7148' },
  carbon: { background: '#16171b', foreground: '#d6e2ff', label: '#86aaff' },
  marble: { background: '#efece6', foreground: '#1c1a17', label: '#7a5a17' },
  titanium: { background: '#8b8f96', foreground: '#121418', label: '#2d3035' },
}

export function walletColors(design: CardDesign) {
  if (design.material === 'custom') return { background: design.base, foreground: '#ffffff', label: '#e9d18a' }
  return MATERIAL_COLORS[design.material] ?? MATERIAL_COLORS.obsidian
}

const env = (k: string) => process.env[k]?.trim() || ''

export type WalletPlatform = 'apple' | 'google'
export interface WalletStatus { platform: WalletPlatform; configured: boolean; missing: string[] }

/** What is configured on this deployment. Never returns secret values, only which pieces are missing. */
export function walletStatus(): Record<WalletPlatform, WalletStatus> {
  const appleNeed: [string, string][] = [
    ['ORYN_APPLE_TEAM_ID', 'Apple Developer Team ID (company Apple Developer Program membership)'],
    ['ORYN_APPLE_PASS_TYPE_ID', 'Pass Type ID (e.g. pass.com.oryn.card)'],
    ['ORYN_APPLE_PASS_CERT_PEM', 'Pass Type ID certificate'],
    ['ORYN_APPLE_PASS_KEY_PEM', 'Private key for that certificate'],
    ['ORYN_APPLE_WWDR_PEM', 'Apple WWDR intermediate certificate'],
  ]
  const googleNeed: [string, string][] = [
    ['ORYN_GOOGLE_WALLET_ISSUER_ID', 'Google Wallet issuer ID (Google Pay & Wallet Console)'],
    ['ORYN_GOOGLE_WALLET_SA_EMAIL', 'Service account email with Wallet API access'],
    ['ORYN_GOOGLE_WALLET_SA_KEY_PEM', 'Service account private key'],
  ]
  const missingApple = appleNeed.filter(([k]) => !env(k)).map(([, d]) => d)
  // Signing and packaging .pkpass files is not built yet, so Apple stays "integration required" even with keys.
  missingApple.push('Pass signing and .pkpass packaging service (not built yet)')
  const missingGoogle = googleNeed.filter(([k]) => !env(k)).map(([, d]) => d)
  return {
    apple: { platform: 'apple', configured: false, missing: missingApple },
    google: { platform: 'google', configured: missingGoogle.length === 0, missing: missingGoogle },
  }
}

/** Apple Wallet pass.json (generic style). Only public card-face data plus the public link. */
export function applePassJson(d: WalletCardData, o: { serial: string; passTypeId: string; teamId: string; webServiceURL?: string; authenticationToken?: string }) {
  return {
    formatVersion: 1,
    passTypeIdentifier: o.passTypeId,
    teamIdentifier: o.teamId,
    serialNumber: o.serial,
    organizationName: 'ORYN',
    description: `${d.name} · ORYN card`,
    logoText: 'ORYN',
    foregroundColor: hexToRgb(d.colors.foreground),
    backgroundColor: hexToRgb(d.colors.background),
    labelColor: hexToRgb(d.colors.label),
    generic: {
      primaryFields: [{ key: 'name', label: 'ORYN', value: d.name }],
      secondaryFields: [
        ...(d.headline ? [{ key: 'headline', label: 'Role', value: d.headline }] : []),
        ...(d.company ? [{ key: 'company', label: 'Company', value: d.company }] : []),
      ],
      backFields: [
        { key: 'link', label: 'My ORYN card', value: d.url, attributedValue: `<a href="${d.url}">Open my card</a>` },
        { key: 'about', label: 'About', value: 'People who scan this see only what I chose to share. They don’t need the app.' },
      ],
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: d.url, messageEncoding: 'iso-8859-1', altText: 'Scan to open my ORYN card' }],
    ...(o.webServiceURL && o.authenticationToken ? { webServiceURL: o.webServiceURL, authenticationToken: o.authenticationToken } : {}),
  }
}

/** Google Wallet Generic pass object. */
export function googleGenericObject(d: WalletCardData, o: { issuerId: string; objectSuffix: string }) {
  const lang = (v: string) => ({ defaultValue: { language: 'en', value: v } })
  return {
    id: `${o.issuerId}.${o.objectSuffix}`,
    classId: `${o.issuerId}.oryn_card`,
    state: 'ACTIVE',
    cardTitle: lang('ORYN'),
    header: lang(d.name),
    ...(d.headline ? { subheader: lang(d.headline) } : {}),
    hexBackgroundColor: d.colors.background,
    ...(d.company ? { textModulesData: [{ id: 'company', header: 'Company', body: d.company }] } : {}),
    barcode: { type: 'QR_CODE', value: d.url, alternateText: 'Scan to open my ORYN card' },
    linksModuleData: { uris: [{ uri: d.url, description: 'Open my ORYN card', id: 'card' }] },
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Signs a "Save to Google Wallet" link (RS256 JWT, as Google specifies). */
export function googleSaveUrl(object: ReturnType<typeof googleGenericObject>, o: { serviceAccountEmail: string; privateKeyPem: string; origin: string }) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: o.serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [o.origin],
    payload: { genericClasses: [{ id: object.classId }], genericObjects: [object] },
  }
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(o.privateKeyPem)
  return `https://pay.google.com/gp/v/save/${input}.${b64url(sig)}`
}

export function googleConfig() {
  return { issuerId: env('ORYN_GOOGLE_WALLET_ISSUER_ID'), serviceAccountEmail: env('ORYN_GOOGLE_WALLET_SA_EMAIL'), privateKeyPem: env('ORYN_GOOGLE_WALLET_SA_KEY_PEM').replace(/\\n/g, '\n') }
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
