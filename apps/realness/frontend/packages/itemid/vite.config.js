import { defineConfig as define_config } from 'vite-plus'

export default define_config({
  test: {
    include: ['tests/**/*.spec.js']
  }
})
