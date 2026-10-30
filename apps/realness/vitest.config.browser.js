/**
 * Specs that need a real browser: OPFS, sync access handles, module workers.
 *
 *   npm run test:browser
 */
import { defineConfig as define_config } from 'vite-plus'
import { playwright } from '@vitest/browser-playwright'
import app_config, { browser_only } from './vite.config.js'
import { out_path } from '#root/src/settings/output.js'

export default define_config(async env => {
  const app = await app_config(env)
  return {
    ...app,
    test: {
      root: '.',
      alias: app.test.alias,
      globals: true,
      include: ['specs/app/browser/**/*.spec.js'],
      testTimeout: 30000,
      fileParallelism: false,
      coverage: {
        enabled: true,
        provider: 'v8',
        include: browser_only,
        thresholds: { lines: 80, branches: 55, statements: 80, functions: 80 },
        reporter: ['text'],
        reportsDirectory: out_path('frontend', 'coverage-browser')
      },
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }]
      }
    }
  }
})
