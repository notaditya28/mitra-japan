import type { Config } from 'tailwindcss';

// Design tokens live in src/styles/tokens.css as CSS variables (RGB triplets)
// so Tailwind opacity modifiers work and 3D materials can read the same values.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: {
        plum: token('plum'),
        sakura: token('sakura'),
        rose: token('rose'),
        blush: token('blush'),
        petal: token('petal'),
        paper: token('paper'),
        ink: token('ink'),
        mist: token('mist'),
        gold: token('gold'),
        matcha: token('matcha'),
        torii: token('torii'),
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Gujarati"',
          'system-ui',
          'sans-serif',
        ],
        display: ['"Shippori Mincho"', '"Noto Sans Devanagari"', '"Noto Sans Gujarati"', 'serif'],
      },
      borderRadius: { card: '20px', 'card-lg': '24px' },
      boxShadow: {
        soft: '0 8px 30px -12px rgb(var(--plum) / 0.25)',
        lift: '0 20px 50px -20px rgb(var(--plum) / 0.35)',
      },
      transitionTimingFunction: { calm: 'cubic-bezier(0.33, 1, 0.68, 1)' },
      keyframes: {
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: { 'ping-slow': 'ping-slow 2.4s cubic-bezier(0, 0, 0.2, 1) infinite' },
    },
  },
  plugins: [],
} satisfies Config;
