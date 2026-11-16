/**
 * v1: a plan note becomes one row of the planning index.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { area_of, plan_summary } from '#root/src/sync/vault-plans.js'

const note = (itemid, body) =>
  `---\nitemid: "${itemid}"\ncreated: 2026-11-13T14:19:24-08:00\n---\n\n${body}`

const PLAN = note(
  '/+1555/plans/1',
  `# Hosting

\`\`\`mermaid
flowchart LR
  h1["h1 one"] --> h2["h2 two"]
  class h1 active;
  class h2 blocked;
\`\`\`

## Nodes

| Node | Goal | Effort |
| ---- | ---- | ------ |
| h1   | One  | cheap  |
| ~~h2~~ ✓ | Two | cheap |

## Notes

Text.
`
)

it('reads a plan: title, area, diagram, and node states', () => {
  assert.deepEqual(plan_summary('Projects/realness-hosting.md', PLAN), {
    itemid: '/+1555/plans/1',
    path: 'Projects/realness-hosting.md',
    title: 'Hosting',
    area: 'Realness',
    scout: false,
    diagram:
      'flowchart LR\n  h1["h1 one"] --> h2["h2 two"]\n  class h1 active;\n  class h2 blocked;\n',
    nodes: { open: 1, done: 1, active: ['h1'], blocked: ['h2'] }
  })
})

it('names a folder plan by its folder and skips notes that are not plans', () => {
  const folder = plan_summary('Projects/realness-leads/index.md', PLAN)
  assert.equal(folder?.area, 'Realness')
  assert.equal(folder?.scout, false)
  assert.equal(
    plan_summary('Projects/realness-leads/index.md', PLAN, true)?.scout,
    true
  )
  assert.equal(plan_summary('Projects/notes.md', '# Not a plan\n'), null)
  assert.equal(plan_summary('Areas/Blog/post.md', PLAN), null)
  assert.equal(plan_summary('Projects/deep/inner/index.md', PLAN), null)
})

it('names an area from its prefix, and keeps an unknown one readable', () => {
  assert.equal(area_of('Projects/seeq-leads/index.md'), 'SEEQ')
  assert.equal(area_of('Projects/site.md'), 'Site')
})
