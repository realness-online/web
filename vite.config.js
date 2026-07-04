import { configDefaults, defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const has_certs =
  existsSync('realness.local-key.pem') && existsSync('realness.local.pem')
const https_port = 443
const http_port = 5173
import wasm from 'vite-plugin-wasm'

const icon_version = process.env['npm_package_version'] || '1'
const project_root = fileURLToPath(new URL('.', import.meta.url))
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

export default defineConfig({
  staged: {
    '*': 'vp check --fix'
  },
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
      '**/tests/**',
      'artifacts/**',
      'src/wasm/tracer.js'
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
        files: ['**/*.{test,spec}.{js,vue}', '**/tests/**/*.{js,vue}'],
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
        files: ['**/tests/**/*.{js,vue}'],
        globals: {
          read_mock_file: 'readonly'
        }
      },
      {
        files: ['vite.config.js'],
        rules: {
          'no-magic-numbers': 'off'
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
      'artifacts/',
      'coverage/',
      'public/*.worker.js',
      'pnpm-lock.yaml'
    ]
  },
  build: {
    target: 'esnext',
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
    port: has_certs ? https_port : http_port,
    watch: {
      ignored: ['**/artifacts/**', '**/dist/**', '**/node_modules/**']
    },
    ...(has_certs && {
      https: {
        key: readFileSync('realness.local-key.pem'),
        cert: readFileSync('realness.local.pem')
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
    alias: {
      '@': path.resolve(project_root, './src'),
      '@@': fileURLToPath(new URL('./tests/mocks', import.meta.url))
    },
    extensions: ['.js', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      stylus: {
        imports: [path.resolve(project_root, './src/style/variables.styl')]
      }
    }
  },
  plugins: [
    vue({
      template: {
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
        navigateFallbackDenylist: [/\.(?:xml|txt|md|json)$/i],
        // Web Push handlers, imported into the generated SW (keeps generateSW
        // precaching untouched). Source: public/push-handlers.js.
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
    include: ['tests/**/*.spec.js'],
    exclude: [
      ...configDefaults.exclude,
      '**/setup.js',
      '**/mocks/**',
      '**/workers/tracer.spec.js'
    ],
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
