/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // Web: se sirve bajo /family-memories/ dentro de GalbaHUB (mismo criterio
  // que Galbateca/NTWE). APK (`--mode android`, Capacitor) y local: raíz.
  base: command === 'build' && mode !== 'android' ? '/family-memories/' : '/',
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}))
