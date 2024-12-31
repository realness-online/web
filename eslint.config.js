import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import pluginVitest from '@vitest/eslint-plugin'
import compat from 'eslint-plugin-compat'

import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import globals from 'globals'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },
  compat.configs['flat/recommended'],
  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig({ extends: ['stylistic'] }),
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*']
  },
  skipFormatting,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
        ...globals.serviceworker
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'vue/multi-word-component-names': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'no-constant-binary-expression': 1,
      indent: 'off',
      'lines-between-class-members': 'off',
      'vue/valid-v-slot': [
        'error',
        {
          allowModifiers: true
        }
      ]
    }
  }
]
// "eslintConfig": {
//   "root": true,
//   "rules": {
//     "vue/require-default-prop": "off",
//     "vue/html-closing-bracket-spacing": [
//       "error",
//       {
//         "selfClosingTag": "always"
//       }
//     ],
//     "vue/html-closing-bracket-newline": [
//       "error",
//       {
//         "singleline": "never",
//         "multiline": "never"
//       }
//     ],
//   }
// },
