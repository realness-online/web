import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { ViteFS } from 'vite-fs'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
   exclude: ['fs']
  },
  server: {
    watch: {
      ignored: ['**/artifacts/**', '**/dist/**', '**/node_modules/**']
    }
  },
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@@/': new URL('./test/', import.meta.url).pathname
    },
    extensions: ['.js', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      stylus: {
        imports: [new URL('./src/style/variables.styl', import.meta.url).pathname],
      }
    }
  },
  plugins: [
    vue(),
    ViteFS()
  ]
})
