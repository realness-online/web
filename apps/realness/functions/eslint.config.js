import globals from 'globals'

export default [
  {
    name: 'functions/files-to-lint',
    files: ['**/*.js']
  },
  {
    name: 'functions/files-to-ignore',
    ignores: ['**/node_modules/**', '**/coverage/**', '**/.firebase/**']
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      camelcase: 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': ['error', { args: 'none' }],
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-destructuring': ['error', { array: true, object: true }],
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'no-nested-ternary': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-await-in-loop': 'warn',
      'comma-dangle': ['error', 'never'],
      curly: ['error', 'multi-or-nest'],
      'max-depth': ['error', 5],
      'max-params': ['error', 4],
      'max-lines-per-function': ['warn', 150],
      complexity: ['warn', 25]
    }
  }
]
