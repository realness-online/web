import {
  configDefaults as config_defaults,
  defineConfig as define_config
} from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'fs'
import path from 'path'
import {
  product_paths,
  project_root as product_root
} from '#root/src/settings/layout.js'
import { frontend_out, out_path } from '#root/src/settings/output.js'
import { local_settings } from '#root/src/settings/environments.js'

const cert_key = path.join(product_root, 'realness.local-key.pem')
const cert = path.join(product_root, 'realness.local.pem')
const has_certs = exists_sync(cert_key) && exists_sync(cert)
const https_port = 443
const http_port = 5173
import wasm from 'vite-plugin-wasm'

/** The durable bundle is built by `build:durable`; dev serves it from the output folder. */
const durable_bundle = () => ({
  name: 'durable-bundle',
  apply: 'serve',
  resolveId(source) {
    if (source === '/pi-durable.browser.js')
      return frontend_out('pi-durable.browser.js')
  },
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const [url] = (request.url ?? '').split('?')
      if (
        url !== '/pi-durable.browser.js' &&
        url !== '/pi-durable.browser.js.map'
      )
        return next()
      const file = frontend_out(url.slice(1))
      if (!exists_sync(file)) {
        response.statusCode = 404
        response.end('missing durable bundle: run npm run build:durable\n')
        return
      }
      response.setHeader(
        'content-type',
        url.endsWith('.map') ? 'application/json' : 'text/javascript'
      )
      response.end(read_file_sync(file))
    })
  }
})

const package_version = JSON.parse(
  read_file_sync(new URL('./package.json', import.meta.url), 'utf8')
).version
const icon_version = package_version
const { app: app_root } = product_paths()
const test_aliases = {
  '/scripts/watch-for-updates.js': `${app_root}/use/watch-for-updates.js`,
  '/pi-durable.browser.js': frontend_out('pi-durable.browser.js')
}
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

/** Same-origin routes to the local gate and model proxy, so a phone reaches them. */
const local_routes = {
  '/gate': {
    target: `http://127.0.0.1:${local_settings.gate_port}`,
    ws: true,
    rewrite: url => url.replace(/^\/gate/, '')
  },
  '/model': {
    target: `http://127.0.0.1:${local_settings.proxy_port}`,
    rewrite: url => url.replace(/^\/model/, '')
  },
  '/sign-in': {
    target: `http://127.0.0.1:${local_settings.sign_in_port}`,
    rewrite: url => url.replace(/^\/sign-in/, '')
  },
  '/sync': {
    target: `http://127.0.0.1:${local_settings.sync_port}`,
    rewrite: url => url.replace(/^\/sync/, '')
  }
}

/** One config for the web app's dev, build, and specs, and the lint and format rules for the whole package; Vite+ reads lint and fmt only from the package root. */
export default define_config(({ mode }) => ({
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'vue'],
    jsPlugins: ['eslint-plugin-compat'],
    categories: {
      correctness: 'warn'
    },
    env: {
      builtin: true,
      es2022: true,
      browser: true,
      node: true,
      serviceworker: true,
      worker: true
    },
    globals: {
      defineProps: 'readonly',
      defineEmits: 'readonly',
      defineExpose: 'readonly',
      defineOptions: 'readonly',
      withDefaults: 'readonly',
      workbox: 'readonly'
    },
    ignorePatterns: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      'public/**/*.js',
      'tracer/**',
      '**/docs/generated/**',
      '**/specs/**',
      'checks/**',
      '**/test/**',
      'src/app/wasm/tracer.js',
      'src/app/prerender/toc.js'
    ],
    rules: {
      'compat/compat': 'error',
      'no-import-assign': 'off',
      curly: ['error', 'multi'],
      'no-console': [
        'error',
        {
          allow: [
            'warn',
            'error',
            'info',
            'time',
            'timeEnd',
            'group',
            'groupEnd'
          ]
        }
      ],
      'no-debugger': 'error',
      'no-unused-vars': [
        'error',
        {
          args: 'none'
        }
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'arrow-body-style': ['error', 'as-needed'],
      'no-param-reassign': 'error',
      'require-await': 'error',
      'max-lines-per-function': ['warn', 200],
      complexity: ['warn', 30],
      'no-unsafe-optional-chaining': 'error',
      'no-constant-binary-expression': 'error',
      'no-unused-private-class-members': 'error',
      'no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: false,
          allowNamedExports: false
        }
      ],
      'prefer-template': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true
        }
      ],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-array-constructor': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'max-nested-callbacks': ['error', 5],
      'prefer-promise-reject-errors': 'error',
      'max-depth': ['error', 5],
      'max-params': ['error', 5],
      'no-magic-numbers': [
        'warn',
        {
          ignore: [
            -1, 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 50, 60, 70, 80, 90
          ],
          enforceConst: true
        }
      ],
      'no-nested-ternary': 'error',
      'vue/define-props-declaration': ['error', 'runtime'],
      'vue/valid-define-props': 'error',
      'vue/define-emits-declaration': ['error', 'runtime'],
      'vue/valid-define-emits': 'error',
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-object-spread': 'error',
      'no-useless-computed-key': 'error',
      'no-template-curly-in-string': 'error',
      'no-await-in-loop': 'warn',
      'no-loss-of-precision': 'error',
      'no-undef': 'error'
    },
    overrides: [
      {
        files: ['**/*.{test,spec}.{js,vue}', '**/specs/**/*.{js,vue}'],
        rules: {
          'vitest/expect-expect': 'error',
          'vitest/no-commented-out-tests': 'error',
          'vitest/no-conditional-expect': 'error',
          'vitest/no-disabled-tests': 'warn',
          'vitest/no-focused-tests': 'error',
          'vitest/no-identical-title': 'error',
          'vitest/no-import-node-test': 'error',
          'vitest/no-interpolation-in-snapshots': 'error',
          'vitest/no-mocks-import': 'error',
          'vitest/no-standalone-expect': 'error',
          'vitest/no-unneeded-async-expect-function': 'error',
          'vitest/prefer-called-exactly-once-with': 'error',
          'vitest/require-local-test-context-for-concurrent-snapshots': 'error',
          'vitest/valid-describe-callback': 'error',
          'vitest/valid-expect': 'error',
          'vitest/valid-expect-in-promise': 'error',
          'vitest/valid-title': 'error'
        },
        plugins: ['vitest'],
        env: {
          jest: true
        }
      },
      {
        files: ['**/specs/**/*.{js,vue}'],
        globals: {
          read_mock_file: 'readonly'
        }
      },
      {
        files: ['vite.config.js'],
        rules: {
          'no-magic-numbers': 'off'
        }
      },
      {
        files: ['scripts/**', 'src/app/views/OgCandidates.vue'],
        rules: {
          'no-await-in-loop': 'off'
        }
      }
    ],
    options: {
      typeAware: false,
      typeCheck: false,
      denyWarnings: true
    }
  },
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'none',
    bracketSameLine: true,
    arrowParens: 'avoid',
    vueIndentScriptAndStyle: true,
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: [
      'dist/',
      'coverage/',
      'public/*.worker.js',
      'src/app/wasm/tracer.js',
      'src/app/prerender/toc.js'
    ]
  },
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
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(package_version)
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['realness.local'],
    proxy: {
      ...(mode === 'dev-local' && local_routes),
      '/v1/': {
        target:
          mode === 'dev-local'
            ? `http://127.0.0.1:${local_settings.sync_port}`
            : 'https://realness-sync-639469569733.us-central1.run.app',
        changeOrigin: true
      },
      '/pay/': {
        target: 'https://realness-proxy-639469569733.us-central1.run.app',
        changeOrigin: true
      }
    },
    port: has_certs ? https_port : http_port,
    watch: {
      ignored: [
        '**/artifacts/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/.auto/**',
        'functions/**',
        'server/**',
        'specs/**',
        'checks/**'
      ]
    },
    ...(has_certs && {
      https: {
        key: read_file_sync(cert_key),
        cert: read_file_sync(cert)
      },
      hmr: {
        host: 'realness.local',
        port: https_port,
        protocol: 'wss'
      }
    }),
    headers: {
      'Access-Control-Allow-Private-Network': 'true',
      'X-Vite-Mode': mode
    }
  },
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@/wasm': out_path('wasm'),
      '@': app_root,
      '/src/app': app_root,
      '@@': file_url_to_path(new URL('./specs/app/mocks', import.meta.url))
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
    durable_bundle(),
    vite_pwa({
      devOptions: { enabled: false },
      filename: 'service.worker.js',
      workbox: {
        clientsClaim: true,
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
    alias: test_aliases,
    globals: true,
    environment: 'happy-dom',
    reporters: ['default'],
    include: ['specs/app/**/*.spec.js', 'packages/*/specs/**/*.spec.js'],
    exclude: [
      ...config_defaults.exclude,
      '**/setup.js',
      '**/mocks/**',
      'specs/app/storage-rules/**'
    ],
    testTimeout: 30000,
    coverage: {
      include: [
        path.join(app_root, '**/*.js'),
        path.join(app_root, '**/*.vue'),
        'packages/*/src/**/*.js',
        'scripts/**/*.js',
        'public/push-handlers.js',
        path.join(product_root, 'src/sign-on/browser/**/*.js'),
        path.join(
          product_root,
          'tools/publish/renderer/static/scripts/**/*.js'
        ),
        path.join(product_root, '..', '.pi/bin/harness/commands/page.js')
      ],
      allowExternal: true,
      exclude: [
        'specs/**',
        'checks/**',
        'mocks/**',
        'node_modules/**',
        'dist/**',
        'docs/**',
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
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: out_path('frontend', 'coverage'),
      reportOnFailure: true
    },
    mockReset: false,
    setupFiles: [
      './specs/app/setup.js',
      './specs/app/mocks/default.js',
      './specs/app/mocks/browser/console.js',
      './specs/app/mocks/browser/fetch.js',
      './specs/app/mocks/browser/worker.js',
      './specs/app/mocks/browser/indexedDB.js',
      './specs/app/mocks/browser/localStorage.js',
      './specs/app/mocks/browser/createrange.js',
      './specs/app/mocks/browser/scrollIntoView.js',
      './specs/app/mocks/browser/IntersectionObserver.js',
      './specs/app/mocks/browser/FileReaderSync.js'
    ]
  }
}))
