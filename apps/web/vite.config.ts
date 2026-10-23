/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  // Pre-bundle everything lazy chunks use, so Vite never re-optimises mid-session
  // (which loads two copies of React and breaks hooks until a hard reload).
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
      'three/examples/jsm/geometries/RoundedBoxGeometry.js',
      'd3-geo',
      'framer-motion',
      'gsap',
      'gsap/ScrollTrigger',
      'lenis',
      'zustand',
      'zustand/middleware',
      'i18next',
      'react-i18next',
    ],
  },
  build: {
    target: 'es2022',
    // three.js only loads with the lazy 3D canvas; keep its chunk out of first paint.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
