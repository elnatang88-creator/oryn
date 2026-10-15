import type { Config } from 'tailwindcss'

/** Visual language (ORIAN direction, 2026-10-15): obsidian, midnight navy, graphite, premium white, silver, electric blue. */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#08090D', 900: '#07132B', 800: '#0F1E3F', 700: '#1B2B52', 600: '#2A3C6B' },
        graphite: { DEFAULT: '#151A24', 700: '#1D2430', 600: '#262E3C' },
        silver: { DEFAULT: '#B9C3D3', 300: '#D6DDE8' },
        electric: { DEFAULT: '#246BFD', 600: '#1A57D6', 400: '#5C8DFF', 300: '#8FB0FF' },
        soft: { 50: '#F7F9FC', 100: '#EEF2F8', 200: '#DEE5F0', 300: '#C9D3E2' },
        ink: { DEFAULT: '#0B1220', muted: '#5A6578', faint: '#8A94A8' },
        signal: { ok: '#0F8A5F', warn: '#A35A00', stop: '#C4283A' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem', capsule: '1.75rem' },
      boxShadow: {
        lift: '0 1px 2px rgba(10,20,51,0.06), 0 8px 24px -12px rgba(10,20,51,0.18)',
        capsule: '0 30px 60px -30px rgba(5,11,31,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        grow: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        growY: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        pulseRing: { '0%': { transform: 'scale(0.98)', opacity: '0.7' }, '100%': { transform: 'scale(1.12)', opacity: '0' } },
      },
      animation: { rise: 'rise 280ms ease-out both', grow: 'grow 700ms cubic-bezier(.2,.8,.2,1) both', 'grow-y': 'growY 600ms cubic-bezier(.2,.8,.2,1) both', 'pulse-ring': 'pulseRing 1.8s ease-out infinite' },
    },
  },
  plugins: [],
}
export default config
