import { fileURLToPath } from 'node:url';

// Explicit config path so Tailwind works whether Vite is started from the repo root or apps/web.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.ts', import.meta.url)) },
    autoprefixer: {},
  },
};
