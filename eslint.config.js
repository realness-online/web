import pluginVue from 'eslint-plugin-vue'
import { configs as vitestConfigs } from '@vitest/eslint-plugin'
import compat from 'eslint-plugin-compat'
import pluginNode from 'eslint-plugin-node'

import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import globals from 'globals'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },
  { rules: { ...compat.configs.recommended.rules } },
  ...pluginVue.configs['vue3-recommended'],
  skipFormatting,
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
      'vue/html-closing-bracket-newline': [
        'error',
        {
          singleline: 'never',
          multiline: 'never'
        }
      ]
    }
  },
  {
    files: ['**/*.{test,spec}.{js,vue}', '**/tests/**/*.{js,vue}'],
    ...vitestConfigs.recommended,
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
]
