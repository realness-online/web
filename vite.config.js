import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(
      process.env['npm_package_version']
    )
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
      './__mocks__/default.js',
      './__mocks__/browser/console.js',
      './__mocks__/browser/fetch.js',
      './__mocks__/browser/indexedDB.js',
      './__mocks__/browser/localStorage.js',
      './__mocks__/browser/createrange.js',
      './__mocks__/browser/scrollIntoView.js',
      './__mocks__/browser/IntersectionObserver.js',
      './__mocks__/browser/FileReaderSync.js'
    ],
    coverage: {
      reporter: ['text', 'html'],
      lines: 90,
      branches: 90,
      statements: 90,
      functions: 90,
      all: true,
      excludeNodeModules: true,
      exclude: ['**/tests/**']
    }
  }
})
