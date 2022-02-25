import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import loadVersion from 'vite-plugin-package-version'
const path = require("path")

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: ['.js', '.json', '.vue']
  },
  plugins: [vue(), loadVersion()]
})
