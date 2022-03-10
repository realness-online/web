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
    global: true,
    environment: 'happy-dom',
    mockReset: false,
    setupFiles: [
      './__mocks__/setup.js',
      './__mocks__/polyfill/indexedDB.js',
      './__mocks__/polyfill/localstorage.js',
      './__mocks__/polyfill/createrange.js',
      './__mocks__/polyfill/scrollIntoView.js',
      './__mocks__/polyfill/IntersectionObserver.js',
      './__mocks__/polyfill/FileReaderSync.js'
    ]
  }
})
