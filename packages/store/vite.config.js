import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.js']
  }
})
