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
      '**/docs/generated/**'
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
      ...pluginVue.configs['vue3-recommended'].rules
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
        process: 'readonly'
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
      'vue/no-unused-properties': ['error', {
        groups: ['props', 'data', 'computed', 'methods']
      }],
      'vue/define-macros-order': ['error', {
        order: ['defineProps', 'defineEmits', 'defineSlots']
      }],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/no-empty-component-block': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'arrow-body-style': ['error', 'as-needed'],
      'no-param-reassign': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'max-lines-per-function': ['warn', 50],
      'complexity': ['warn', 10],
      'no-unsafe-optional-chaining': 'error',
      'no-constant-binary-expression': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-use-before-define': ['error', { functions: false }],
      'prefer-template': 'error',
      'prefer-destructuring': ['error', { array: true, object: true }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-array-constructor': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'max-nested-callbacks': ['error', 3],
      'prefer-promise-reject-errors': 'error',
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'no-magic-numbers': ['warn', {
        ignore: [-1, 0, 1, 2],
        enforceConst: true
      }],
      'no-nested-ternary': 'error',
      'vue/no-static-inline-styles': ['error', {
        allowBinding: true
      }],
      'vue/no-template-target-blank': 'error',
      'vue/no-useless-template-attributes': 'error',
      'vue/no-potential-component-option-typo': 'error',
      'vue/no-duplicate-attr-inheritance': 'error',
      'vue/require-name-property': 'error',
      'vue/v-on-handler-style': ['error', ['method', 'inline-function']],
      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/no-ref-object-destructure': 'error',
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/no-unused-refs': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/prefer-separate-static-class': 'error'
    }
  },
  {
    files: ['**/*.{test,spec}.{js,vue}', '**/tests/**/*.{js,vue}'],
    plugins: {
      vitest: vitest
    },
    rules: {
      ...vitest.configs.recommended.rules
    },
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
]
