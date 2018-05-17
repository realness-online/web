// https://github.com/facebook/jest/blob/master/docs/Configuration.md
const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '../../'),
  moduleFileExtensions: [
    'js',
    'json',
    'vue'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.js$': '<rootDir>/node_modules/babel-jest',
    '.*\\.(vue)$': '<rootDir>/node_modules/vue-jest'
  },
  testPathIgnorePatterns: [
    '<rootDir>/test/e2e'
  ],
  snapshotSerializers: ['<rootDir>/node_modules/jest-serializer-vue'],
  setupFiles: [
    '<rootDir>/test/unit/setup',
    '<rootDir>/test/polyfill/createRange.js',
    '<rootDir>/test/polyfill/scrollIntoView.js',
    'jest-localstorage-mock'
  ],
  verbose:true,
  collectCoverage: true,
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": -10
    }
  },
  coverageDirectory: '<rootDir>/test/unit/coverage',
  cacheDirectory: '<rootDir>/test/unit/cache',
  collectCoverageFrom: [
    'src/**/*.{js,vue}',
    '!src/main.js',
    '!**/node_modules/**'
  ]
}
