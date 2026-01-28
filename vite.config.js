import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import fs from 'fs'
import path from 'path'
import wasm from 'vite-plugin-wasm'

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
    host: '127.0.0.1',
    port: 8080,
    watch: {
      ignored: ['**/artifacts/**', '**/dist/**', '**/node_modules/**']
    },
    https: {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem')
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@@': fileURLToPath(new URL('./tests/mocks', import.meta.url))
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
    wasm(),
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
    root: '.',
    globals: true,
    environment: 'happy-dom',
    reporters: ['verbose'],
    include: ['tests/**/*.spec.js'],
    exclude: [...configDefaults.exclude, '**/setup.js', '**/mocks/**'],
    testTimeout: 30000,
    coverage: {
      include: ['src/**/*.js', 'src/**/*.vue'],
      exclude: [
        'tests/**',
        'mocks/**',
        'node_modules/**',
        'dist/**',
        'docs/**',
        'public/**',
        'src/main.js',
        'src/router.js',
        'src/wasm/**'
      ],
      lines: 80,
      branches: 80,
      statements: 80,
      functions: 80,
      all: true,
      excludeNodeModules: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      reportOnFailure: true
    },
    mockReset: false,
    setupFiles: [
      './tests/setup.js',
      './tests/mocks/default.js',
      './tests/mocks/browser/console.js',
      './tests/mocks/browser/fetch.js',
      './tests/mocks/browser/worker.js',
      './tests/mocks/browser/indexedDB.js',
      './tests/mocks/browser/localStorage.js',
      './tests/mocks/browser/createrange.js',
      './tests/mocks/browser/scrollIntoView.js',
      './tests/mocks/browser/IntersectionObserver.js',
      './tests/mocks/browser/FileReaderSync.js'
    ]
  }
})
