/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // En producción se sirve bajo /family-memories/ dentro de GalbaHUB. Mismo
  // criterio que Galbateca/NTWE: base absoluta en build, raíz en local.
  base: command === 'build' ? '/family-memories/' : '/',
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}))
