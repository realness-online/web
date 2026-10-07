import { defineConfig as define_config } from 'vite-plus'

export default define_config({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.spec.js']
  }
})
