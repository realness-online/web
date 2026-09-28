import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

/** The page builds to static files; the host serves them. */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.js']
  }
})
