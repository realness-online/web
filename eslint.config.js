/* eslint-disable no-magic-numbers */
import pluginVue from 'eslint-plugin-vue'
import vitest from '@vitest/eslint-plugin'
import compat from 'eslint-plugin-compat'
import globals from 'globals'
import * as vue_parser from 'vue-eslint-parser'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      'public/**/*.js',
      'tracer/**',
      '**/docs/generated/**',
      '**/tests/**',
      'artifacts/**'
    ]
  },
  {
    plugins: {
      compat
    },
    rules: {
      ...compat.configs.recommended.rules
    }
  },
  {
    files: ['**/*.vue'],
    plugins: {
      vue: pluginVue
    },
    processor: pluginVue.processors['.vue'],
    languageOptions: {
      parser: vue_parser
    },
    rules: {
      ...pluginVue.configs['flat/recommended'].rules
    }
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
        ...globals.serviceworker,
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
        process: 'readonly',
        workbox: 'readonly'
      }
    }
  },
  {
    plugins: {
      vue: pluginVue
    },
    rules: {
      'no-import-assign': 'off',
      camelcase: 'off',
      indent: 'off',
      'lines-between-class-members': 'off',
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
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'arrow-body-style': ['error', 'as-needed'],
      'no-param-reassign': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'max-lines-per-function': ['warn', 200],
      complexity: ['warn', 30],
      'no-unsafe-optional-chaining': 'error',
      'no-constant-binary-expression': 'error',
      'no-unreachable-loop': 'error',
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
      'prefer-destructuring': ['error', { array: true, object: true }],
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
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/prop-name-casing': ['error', 'snake_case'],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-spacing': [
        'error',
        {
          selfClosingTag: 'always'
        }
      ],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/no-unused-refs': 'error',
      'vue/no-v-html': 'error',
      'vue/no-unused-properties': [
        'error',
        {
          groups: ['props', 'data', 'computed', 'methods']
        }
      ],
      'vue/define-macros-order': [
        'error',
        {
          order: ['defineProps', 'defineEmits', 'defineSlots']
        }
      ],
      'vue/define-props-declaration': ['error', 'runtime'],

      'vue/valid-define-props': 'error',
      'vue/no-empty-component-block': 'error',
      'vue/no-multiple-objects-in-class': 'error',
      'vue/no-static-inline-styles': [
        'error',
        {
          allowBinding: true
        }
      ],
      'vue/no-template-target-blank': 'error',
      'vue/no-useless-template-attributes': 'error',
      'vue/no-potential-component-option-typo': 'error',
      'vue/no-duplicate-attr-inheritance': 'error',
      'vue/require-name-property': 'error',

      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/no-ref-object-reactivity-loss': 'error',
      'vue/define-emits-declaration': ['error', 'runtime'],
      'vue/valid-define-emits': 'error',
      'vue/no-unused-refs': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/prefer-separate-static-class': 'error',
      'arrow-spacing': ['error', { before: true, after: true }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'no-floating-decimal': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'prefer-object-spread': 'error',
      'no-useless-computed-key': 'error',
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style']
        }
      ],
      'vue/component-name-in-template-casing': [
        'error',
        'kebab-case',
        {
          registeredComponentsOnly: false,
          ignores: []
        }
      ],
      'vue/html-comment-content-spacing': ['error', 'always'],
      'vue/next-tick-style': ['error', 'promise'],
      'vue/no-reserved-component-names': 'error',
      'vue/padding-line-between-blocks': 'error',
      'no-template-curly-in-string': 'error',
      'require-atomic-updates': 'error',
      'no-await-in-loop': 'warn',
      'no-loss-of-precision': 'error',
      'comma-dangle': ['error', 'never'],
      'no-undef': 'error',
      'vue/no-mutating-props': 'error',
      'vue/return-in-computed-property': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/no-v-html': 'warn',
      'vue/v-on-event-hyphenation': ['error', 'always'],
      'vue/no-template-shadow': 'error',
      'vue/order-in-components': 'error',
      'vue/no-duplicate-attributes': 'error',
      'vue/require-v-for-key': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/valid-v-for': 'error',
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/no-setup-props-reactivity-loss': 'error'
    }
  },
  {
    files: ['**/*.{test,spec}.{js,vue}', '**/tests/**/*.{js,vue}'],
    plugins: {
      vitest
    },
    rules: {
      ...vitest.configs.recommended.rules
    },
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  },
  {
    files: ['**/tests/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        read_mock_file: 'readonly'
      }
    }
  }
]
