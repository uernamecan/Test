import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        mist: '#94a3b8',
        accent: '#fa233b',
        aurora: '#fb7185'
      },
      boxShadow: {
        soft: '0 18px 48px rgba(15, 23, 42, 0.12)'
      },
      backgroundImage: {
        'mesh-glow':
          'radial-gradient(circle at top left, rgba(250, 35, 59, 0.16), transparent 36%), radial-gradient(circle at top right, rgba(251, 113, 133, 0.12), transparent 34%), linear-gradient(180deg, rgba(18, 18, 20, 0.98), rgba(24, 24, 27, 0.96))'
      }
    }
  },
  plugins: []
} satisfies Config
