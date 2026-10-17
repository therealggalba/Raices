/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // App version (package.json) shown in the options menu; the APK build number
  // comes from CI (VITE_BUILD_NUMBER = GitHub Actions run number).
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Web: se sirve bajo /family-memories/ dentro de GalbaHUB (mismo criterio
  // que Galbateca/NTWE). APK (`--mode android`, Capacitor) y local: raíz.
  base: command === 'build' && mode !== 'android' ? '/family-memories/' : '/',
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}))
