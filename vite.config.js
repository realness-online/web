import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'vue',
            'vue-router',
            '@vueuse/core',
            '@firebase/app',
            '@firebase/auth',
            '@firebase/firestore',
            '@firebase/storage'
          ],
          utilities: ['libphonenumber-js', 'exifreader']
        }
      }
    }
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(
      process.env['npm_package_version']
    )
  },
  server: {
    port: 8080,
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
  plugins: [
    vue(),
    vite_pwa({
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000
      },
      filename: 'service.worker.js',
      minify: true,
      includeAssets: [
        '180.png',
        'vector.worker.js',
        'fonts/*.woff2',
        'icons.svg'
      ],
      manifest: {
        display: 'standalone',
        background_color: '#151518',
        name: 'Realness',
        short_name: 'Realness',
        description: 'Realness – A Chill Vector Space',
        scope: '/',
        orientation: 'portrait',
        theme_color: '#151518',
        icons: [
          { src: '192.png', sizes: '192x192', type: 'image/png' },
          { src: '512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    root: 'web',
    globals: true,
    environment: 'happy-dom',
    mockReset: false,
    setupFiles: [
      './tests/__mocks__/default.js',
      './tests/__mocks__/browser/console.js',
      './tests/__mocks__/browser/fetch.js',
      './tests/__mocks__/browser/worker.js',
      './tests/__mocks__/browser/indexedDB.js',
      './tests/__mocks__/browser/localStorage.js',
      './tests/__mocks__/browser/createrange.js',
      './tests/__mocks__/browser/scrollIntoView.js',
      './tests/__mocks__/browser/IntersectionObserver.js',
      './tests/__mocks__/browser/FileReaderSync.js'
    ],
    coverage: {
      reporter: ['text', 'html'],
      lines: 90,
      branches: 90,
      statements: 90,
      functions: 90,
      all: true,
      excludeNodeModules: true,
      exclude: [
        ...configDefaults.exclude,
        '**/tests/**',
        '**/__mocks__/**',
        '**/public/**'
      ]
    }
  }
})
