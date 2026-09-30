import type { Config } from 'tailwindcss'

/** ORYN visual language: deep navy, electric blue, white and soft blue. Calm surfaces, one bright accent. */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#000A24', 900: '#011441', 800: '#0B2157', 700: '#1C2E63', 600: '#2A3F7E' },
        electric: { DEFAULT: '#0053FD', 600: '#0046D6', 400: '#4D84FF', 300: '#86AAFF' },
        soft: { 50: '#F6F8FE', 100: '#EDF2FF', 200: '#DCE6FF', 300: '#C3D3FB' },
        ink: { DEFAULT: '#0B1530', muted: '#5B6785', faint: '#8A94AD' },
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
        pulseRing: { '0%': { transform: 'scale(0.98)', opacity: '0.7' }, '100%': { transform: 'scale(1.12)', opacity: '0' } },
      },
      animation: { rise: 'rise 280ms ease-out both', 'pulse-ring': 'pulseRing 1.8s ease-out infinite' },
    },
  },
  plugins: [],
}
export default config
