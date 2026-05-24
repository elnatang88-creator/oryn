import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#0A0A0A',
          soft: '#141414',
          card: '#1C1C1E',
          raised: '#252523',
          border: '#2C2C2E',
          muted: '#3A3A3C',
        },
        olive: {
          DEFAULT: '#4A5240',
          light: '#6B7A5C',
          muted: '#8B9A7A',
          subtle: '#C5CDB8',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#D4AF37',
          shine: '#F5E6A3',
          muted: '#8B7340',
          dark: '#5C4A1E',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          soft: '#EDE8DE',
          dark: '#D4CDBB',
          muted: '#A09880',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'card-gradient': 'linear-gradient(135deg, #1C1C1E 0%, #252523 50%, #1C1C1E 100%)',
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #F5E6A3 50%, #C9A84C 100%)',
        'gold-shine': 'linear-gradient(105deg, transparent 40%, rgba(245,230,163,0.15) 50%, transparent 60%)',
        'olive-gradient': 'linear-gradient(135deg, #4A5240 0%, #6B7A5C 100%)',
        'hero-radial': 'radial-gradient(ellipse at 50% 40%, #1C2B1A 0%, #0A0A0A 65%)',
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      animation: {
        'card-float': 'cardFloat 7s ease-in-out infinite',
        'gold-shimmer': 'goldShimmer 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 20s linear infinite',
      },
      keyframes: {
        cardFloat: {
          '0%, 100%': { transform: 'translateY(0px) rotate(-6deg) rotateX(5deg)' },
          '50%': { transform: 'translateY(-24px) rotate(-4deg) rotateX(8deg)' },
        },
        goldShimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201,168,76,0.1)' },
        },
        rotateSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'card': '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover': '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
        'gold': '0 0 30px rgba(201,168,76,0.3), 0 0 60px rgba(201,168,76,0.1)',
        'glow-sm': '0 0 15px rgba(201,168,76,0.2)',
        'glow': '0 0 40px rgba(201,168,76,0.15)',
        'glow-lg': '0 0 80px rgba(201,168,76,0.1)',
        'inner-gold': 'inset 0 1px 0 rgba(201,168,76,0.15), inset 0 -1px 0 rgba(0,0,0,0.3)',
      },
      borderRadius: {
        'card': '16px',
        'panel': '12px',
        'chip': '8px',
      },
    },
  },
  plugins: [],
}

export default config
