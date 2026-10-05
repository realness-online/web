import { defineConfig as define_config } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath as file_url_to_path } from 'node:url'

/** The page builds to static files; the host serves them. */
export default define_config({
  plugins: [vue()],
  resolve: {
    alias: { '@': file_url_to_path(new URL('./src', import.meta.url)) }
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.js']
  }
})
