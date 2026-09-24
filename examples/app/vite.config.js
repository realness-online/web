import { defineConfig } from 'vite'
import { file_api } from './file-api.js'

// base './': the build works under any mount, such as the host's /s/<id>/ (u3).
export default defineConfig({
  base: './',
  resolve: { preserveSymlinks: true },
  plugins: [file_api()]
})