import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
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
        imports: [
          new URL('./src/style/variables.styl', import.meta.url).pathname
        ]
      }
    }
  },
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: [
      './tests/unit/setup.js',
      './tests/polyfill/createrange.js',
      './tests/polyfill/scrollIntoView.js',
      './tests/polyfill/IntersectionObserver.js',
      './tests/polyfill/FileReaderSync.js'
    ]
  }
})
