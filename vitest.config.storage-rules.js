import { defineConfig } from 'vite'

// Storage rules run against the real emulator, so this config deliberately
// skips tests/setup.js — that file mocks firebase, which is the one thing
// these tests must not do.
export default defineConfig({
  test: {
    root: '.',
    globals: true,
    environment: 'node',
    include: ['tests/storage-rules/*.test.js'],
    fileParallelism: false,
    testTimeout: 30000,
    teardownTimeout: 15000
  }
})
