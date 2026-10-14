import {
  configDefaults as config_defaults,
  defineConfig as define_config
} from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'fs'
import path from 'path'
import { product_paths } from '#root/src/settings/layout.js'
import { frontend_out, out_path } from '#root/src/settings/output.js'

const has_certs =
  exists_sync('realness.local-key.pem') && exists_sync('realness.local.pem')
const https_port = 443
const http_port = 5173
import wasm from 'vite-plugin-wasm'

const icon_version = process.env['npm_package_version'] || '1'
const { app: app_root } = product_paths()
const manual_chunk_rules = {
  firebase_auth: ['@firebase/auth'],
  vendor: [
    'vue',
    'vue-router',
    '@vueuse/core',
    '@firebase/app',
    '@firebase/firestore',
    '@firebase/storage'
  ],
  libphonenumber: ['libphonenumber-js']
}

const get_manual_chunk = id => {
  for (const [chunk_name, package_names] of Object.entries(manual_chunk_rules))
    for (const package_name of package_names)
      if (id.includes(`/node_modules/${package_name}/`)) return chunk_name
}

export default define_config({
  build: {
    outDir: frontend_out(),
    emptyOutDir: true,
    target: 'esnext',
    cssTarget: ['safari15', 'chrome111'],
    cssMinify: 'lightningcss',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: get_manual_chunk
      }
    }
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(
      process.env['npm_package_version']
    )
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['realness.local'],
    proxy: {
      ...(process.env.BRAYNESS_LOCAL === '1' && {
        '/gate': {
          target: 'http://127.0.0.1:8792',
          ws: true,
          rewrite: url => url.replace(/^\/gate/, '')
        }
      }),
      '/v1/': {
        target: 'https://brayness-sync-639469569733.us-central1.run.app',
        changeOrigin: true
      },
      '/pay/': {
        target: 'https://brayness-proxy-639469569733.us-central1.run.app',
        changeOrigin: true
      }
    },
    port: has_certs ? https_port : http_port,
    watch: {
      ignored: ['**/artifacts/**', '**/dist/**', '**/node_modules/**']
    },
    ...(has_certs && {
      https: {
        key: read_file_sync('realness.local-key.pem'),
        cert: read_file_sync('realness.local.pem')
      },
      hmr: {
        host: 'realness.local',
        port: https_port,
        protocol: 'wss'
      }
    }),
    headers: {
      'Access-Control-Allow-Private-Network': 'true'
    }
  },
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@/wasm': out_path('wasm'),
      '@': app_root,
      '/src/app': app_root,
      '@@': file_url_to_path(new URL('./tests/mocks', import.meta.url))
    },
    extensions: ['.js', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      stylus: {
        imports: [path.join(app_root, 'style/base-line.styl')]
      }
    }
  },
  plugins: [
    vue({
      template: {
        transformAssetUrls: { includeAbsolute: true },
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('stripe-')
        }
      }
    }),
    wasm(),
    vite_pwa({
      devOptions: { enabled: false },
      filename: 'service.worker.js',
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000,
        globIgnores: ['**/ghostty-vt-*.wasm'],
        navigateFallbackDenylist: [/\.(?:xml|txt|md|json)$/i],
        importScripts: ['/push-handlers.js']
      },
      minify: true,
      includeAssets: [
        'vector.worker.js',
        'fonts/*.woff2',
        'icons.svg',
        'brands/*.svg',
        'brands/*.png',
        'sitemap.xml',
        'robots.txt',
        'llms.txt',
        'documentation.md'
      ],
      manifest: {
        display: 'standalone',
        lang: 'en',
        start_url: '/',
        background_color: '#2c2c26',
        name: 'Realness',
        short_name: 'Realness',
        description: 'Realness',
        scope: '/',
        orientation: 'portrait',
        theme_color: '#2c2c26',
        icons: [
          {
            src: `192.png?v=${icon_version}`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `512.png?v=${icon_version}`,
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
    reporters: ['default'],
    include: ['tests/**/*.spec.js', 'packages/*/tests/**/*.spec.js'],
    exclude: [...config_defaults.exclude, '**/setup.js', '**/mocks/**'],
    testTimeout: 30000,
    coverage: {
      include: [
        path.join(app_root, '**/*.js'),
        path.join(app_root, '**/*.vue')
      ],
      allowExternal: true,
      exclude: [
        'tests/**',
        'mocks/**',
        'node_modules/**',
        'dist/**',
        'docs/**',
        'public/**',
        path.join(app_root, 'main.js'),
        path.join(app_root, 'router.js'),
        path.join(app_root, 'wasm/**')
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        statements: 80,
        functions: 80
      },
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: out_path('frontend', 'coverage'),
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
