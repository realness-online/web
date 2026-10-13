import { defineConfig as define_config } from 'vite'

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
