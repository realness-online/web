import { defineConfig as define_config } from 'vite-plus'

/** Lint and format rules; Vite+ reads them only from the package root. */
export default define_config({
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
      'frontend/public/**/*.js',
      'frontend/tracer/**',
      '**/docs/generated/**',
      '**/tests/**',
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
        files: ['frontend/vite.config.js'],
        rules: {
          'no-magic-numbers': 'off'
        }
      },
      {
        files: ['frontend/scripts/**', 'src/app/views/OgCandidates.vue'],
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
      'frontend/dist/',
      'frontend/coverage/',
      'frontend/public/*.worker.js',
      'src/app/wasm/tracer.js',
      'src/app/prerender/toc.js'
    ]
  }
})
