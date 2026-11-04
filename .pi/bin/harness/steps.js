/**
 * The only list of what `npm run check`, `npm test`, and `npm run live` run.
 * Each step runs from the repo root.
 * @typedef {{ name: string, area: 'harness' | 'realness' | 'repo', run: string, note?: string }} Step
 */

export const harness_specs = ['.pi/bin/specs/**/*.spec.js', '.pi/extensions/**/*.test.js', '.pi/skills/**/*.test.js']

/** @type {{ check: Step[], test: Step[], live: Step[] }} */
export const steps = {
  check: [
    { name: 'skills', area: 'harness', run: 'node .pi/bin/checks/check-skills.js' },
    { name: 'ext', area: 'harness', run: 'node .pi/bin/checks/no-mjs.js' },
    { name: 'soundness', area: 'harness', run: 'node .pi/bin/checks/soundness-check.js apps/realness .pi/bin' },
    {
      name: 'comments',
      area: 'harness',
      run: 'node .pi/bin/checks/comment-check.js apps/realness .pi/bin .pi/skills .pi/extensions'
    },
    { name: 'plan-shape', area: 'harness', run: 'node .pi/bin/plans/plan-shape.js' },
    {
      name: 'palette',
      area: 'harness',
      run: 'node .pi/bin/graphics/themes.js --check && node .pi/bin/graphics/palette-sync.js --check'
    },
    { name: 'ds-store', area: 'harness', run: 'node .pi/bin/checks/ds-store.js' },
    { name: 'doc-scripts', area: 'harness', run: 'node .pi/bin/checks/doc-scripts.js' },
    { name: 'format', area: 'harness', run: 'node .pi/bin/checks/format.js' },
    { name: 'dead-code', area: 'harness', run: 'apps/realness/node_modules/.bin/fallow dead-code --fail-on-issues' },
    { name: 'lint-backend', area: 'realness', run: 'npm --prefix apps/realness run check:backend' },
    { name: 'lint-frontend', area: 'realness', run: 'npm --prefix apps/realness run check:frontend' },
    { name: 'lint-functions', area: 'realness', run: 'npm --prefix apps/realness run check:functions' },
    { name: 'type', area: 'realness', run: 'npm --prefix apps/realness run type' },
    { name: 'type-backend', area: 'realness', run: 'npm --prefix apps/realness run type:backend' },
    { name: 'dead-code', area: 'realness', run: 'npm --prefix apps/realness run dead-code' }
  ],
  test: [{ name: 'coverage', area: 'repo', run: 'node .pi/bin/checks/coverage.js' }],
  live: [
    { name: 'halo', area: 'realness', run: 'npm --prefix apps/realness run check:halo' },
    {
      name: 'boundary',
      area: 'realness',
      run: 'npm --prefix apps/realness run check:boundary',
      note: 'spends model tokens'
    },
    { name: 'fresh-actor', area: 'realness', run: 'npm --prefix apps/realness run check:fresh-actor' },
    { name: 'actor-request', area: 'realness', run: 'npm --prefix apps/realness run check:actor-request' },
    { name: 'chat', area: 'realness', run: 'npm --prefix apps/realness run check:chat' },
    { name: 'chat-limit', area: 'realness', run: 'npm --prefix apps/realness run check:chat-limit' },
    { name: 'publish', area: 'realness', run: 'npm --prefix apps/realness run check:publish' },
    { name: 'site', area: 'realness', run: 'npm --prefix apps/realness run check:site' },
    {
      name: 'pi-exit',
      area: 'realness',
      run: 'npm --prefix apps/realness run check:pi-exit',
      note: 'spends model tokens'
    },
    { name: 'local', area: 'realness', run: 'npm --prefix apps/realness run check:local' },
    { name: 'page-layout', area: 'realness', run: 'npm --prefix apps/realness run check:page-layout' },
    { name: 'browser', area: 'realness', run: 'npm --prefix apps/realness run test:browser' },
    { name: 'rules', area: 'realness', run: 'npm --prefix apps/realness run test:rules' },
    { name: 'pwa-offline', area: 'realness', run: 'npm --prefix apps/realness run check:pwa-offline' },
    { name: 'google', area: 'realness', run: 'npm --prefix apps/realness run check:google' },
    { name: 'capacity', area: 'realness', run: 'npm --prefix apps/realness run check:capacity' }
  ]
}
