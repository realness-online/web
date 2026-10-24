import { defineConfig as define_config } from 'vite'

export default define_config({
  test: {
    root: '.',
    globals: true,
    environment: 'node',
    include: ['specs/app/storage-rules/*.spec.js'],
    fileParallelism: false,
    testTimeout: 30000,
    teardownTimeout: 15000
  }
})
