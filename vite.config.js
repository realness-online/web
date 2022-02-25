import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import.meta.env.VITE_APP_VERSION = require('./package.json').version
// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: ['.js', '.json', '.vue']
  },
  plugins: [vue()]
})
