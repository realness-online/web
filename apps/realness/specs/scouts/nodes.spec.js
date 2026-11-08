import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { open_nodes, scout_nodes } from '#root/src/scouts/nodes.js'

const PLAN = `# Plan

\`\`\`mermaid
flowchart LR
  a1["a1 one"] --> G1{{"GATE 1"}}
\`\`\`

## Nodes

| id       | goal        | effort |
| -------- | ----------- | ------ |
| ~~a0~~ ✓ | done thing  | cheap  |
| a1       | open thing  | cheap  |
| G1       | a gate      | cheap  |

## Notes

| id | not | a node |
`

it('open nodes skip finished rows, gates, and tables outside Nodes', () => {
  assert.deepEqual(open_nodes(PLAN), [{ id: 'a1', goal: 'open thing' }])
})

it('a nested scout reads the nearest plan above its folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-nodes-'))
  const projects = join(root, 'Projects')
  const folder = join(projects, 'Scouts/SMS')
  await mkdir(folder, { recursive: true })
  await writeFile(join(projects, 'Scouts/index.md'), PLAN)
  assert.deepEqual(scout_nodes(folder, projects), [
    { id: 'a1', goal: 'open thing' }
  ])
  await writeFile(join(folder, 'index.md'), '# none\n')
  assert.deepEqual(scout_nodes(folder, projects), [])
  await rm(root, { recursive: true })
})
