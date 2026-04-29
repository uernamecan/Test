import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        mist: '#94a3b8',
        accent: '#f97316',
        aurora: '#14b8a6'
      },
      boxShadow: {
        soft: '0 18px 48px rgba(15, 23, 42, 0.18)'
      },
      backgroundImage: {
        'mesh-glow':
          'radial-gradient(circle at top left, rgba(20, 184, 166, 0.32), transparent 42%), radial-gradient(circle at top right, rgba(249, 115, 22, 0.24), transparent 36%), linear-gradient(180deg, rgba(9, 14, 24, 0.98), rgba(14, 21, 34, 0.96))'
      }
    }
  },
  plugins: []
} satisfies Config

