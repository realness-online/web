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
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
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
      ]
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
