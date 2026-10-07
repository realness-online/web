import { defineConfig as define_config } from 'vite'

// Storage rules run against the real emulator, so this config deliberately
// skips tests/setup.js — that file mocks firebase, which is the one thing
// these tests must not do.
export default define_config({
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
