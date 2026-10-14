import { defineConfig as define_config } from 'vitest/config'

export default define_config({
  test: {
    environment: 'node',
    coverage: {
      include: ['src/**/*.js', 'index.js'],
      exclude: ['tests/**', 'node_modules/**'],
      lines: 80,
      branches: 80,
      statements: 80,
      functions: 80,
      all: true,
      excludeNodeModules: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      reportOnFailure: true
    }
  }
})
