import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFile as exec_file } from 'node:child_process'
import { randomUUID as random_uuid } from 'node:crypto'
import { copyFile as copy_file, mkdir, rm, symlink, writeFile as write_file } from 'node:fs/promises'
import { promisify } from 'node:util'

const root = new URL(`../../../../artifacts/realness/plan-shape-${random_uuid()}/`, import.meta.url).pathname
after(() => rm(root, { recursive: true, force: true }))

const LIB = ['harness-settings', 'product', 'palette', 'plan-files', 'plan-gates', 'mermaid-render']
const DAG = {
  plain: 'flowchart TD\n a["a test"]',
  active: 'flowchart TD\n a["a test"]\n classDef active fill:#356e6e,stroke:#74b9b9,color:#ecebe4;\n class a active;',
  gate: 'flowchart TD\n a["a test"] --> G{{"◆ GATE 1"}}\n class G gate;',
  emoji: 'flowchart TD\n a["a test"]\n %% ✅ done'
}

/** A checkout with the checker and one plan, run the way `npm run check` runs it. */
const check = async (id, body, { plans = 'vault/plans' } = {}) => {
  const fixture = `${root}${id}`
  await mkdir(`${fixture}/.pi/bin/lib`, { recursive: true })
  await mkdir(`${fixture}/.pi/bin/plans`, { recursive: true })
  await mkdir(`${fixture}/apps`, { recursive: true })
  await mkdir(`${fixture}/${plans}`, { recursive: true })
  await copy_file(new URL('../../plans/plan-shape.js', import.meta.url), `${fixture}/.pi/bin/plans/plan-shape.js`)
  for (const name of LIB)
    await copy_file(new URL(`../../lib/${name}.js`, import.meta.url), `${fixture}/.pi/bin/lib/${name}.js`)
  await symlink(new URL('../../../../apps/realness', import.meta.url), `${fixture}/apps/realness`)
  await mkdir(`${fixture}/.pi/node_modules`, { recursive: true })
  await symlink('../../apps/realness', `${fixture}/.pi/node_modules/realness`)
  await write_file(`${fixture}/package.json`, JSON.stringify({ type: 'module', realness: { plans } }))
  await write_file(`${fixture}/${plans}/p.md`, body)
  const { stdout } = await promisify(exec_file)(process.execPath, [`${fixture}/.pi/bin/plans/plan-shape.js`]).catch(
    error => ({ stdout: error.stdout ?? '' })
  )
  return stdout
}

const plan = ({ dag = DAG.plain, legend = null }) =>
  [
    '# P',
    '',
    '```mermaid',
    dag,
    '```',
    '',
    '## Nodes',
    '',
    '| Node | Goal | Done when |',
    '| ---- | ---- | --------- |',
    '| a    | test | a spec    |',
    '',
    '## Notes',
    '',
    ...(legend === null ? [] : [legend, ''])
  ].join('\n')

it('a summary sits between the DAG and the nodes', async () => {
  const summary = '## Summary\n\nPeople can open the phone book with a key.\n\n'
  const body = plan({})
  assert.match(await check('summary-first', body.replace('## Nodes', `${summary}## Nodes`)), /1 plans, 0 failed/)
  assert.match(await check('summary-late', body.replace('## Notes', `${summary}## Notes`)), /summary then nodes/)
})

it('a plan that marks no state needs no legend', async () => {
  assert.match(await check('unmarked', plan({})), /1 plans, 0 failed/)
})

it('a marked plan without a legend line fails', async () => {
  const out = await check('missing', plan({ dag: DAG.active }))
  assert.match(out, /FAIL p\.md/)
  assert.match(out, /legend line: no "\*\*Legend:\*\*" line at the bottom of the plan/)
})

it('the legend names all three states and sits last', async () => {
  const out = await check('symbols', plan({ dag: DAG.active, legend: '**Legend:** ◐ active, × blocked. ◆ gate.' }))
  assert.match(out, /legend line: .*names ✕ not at all/)
  const above = await check(
    'above',
    plan({ dag: DAG.gate }).replace('```mermaid', '**Legend:** ◐ active (teal), ✕ blocked (red), ◆ gate.\n\n```mermaid')
  )
  assert.match(above, /legend line: .*it goes last in the plan/)
})

it('a legend at the bottom passes, gate or not', async () => {
  const legend = '**Legend:** ◐ active (teal), ✕ blocked (red), ◆ gate.'
  assert.match(await check('placed', plan({ dag: DAG.active, legend })), /1 plans, 0 failed/)
})

it('a legend that lists pruned items fails', async () => {
  const legend = '**Legend:** ◐ active (teal), ✕ blocked (red), ◆ gate. Done items pruned: a1 (2026-11-07).'
  assert.match(await check('pruned', plan({ dag: DAG.active, legend })), /legend line: .*lists pruned items/)
})

it('a color emoji fails, and the plain characters pass', async () => {
  const out = await check('emoji', plan({ dag: DAG.emoji }))
  assert.match(out, /symbols: .*✅ is a color emoji; write ✓ ◐ ✕ ◆/)
  const plain = await check(
    'plain-symbols',
    plan({ dag: DAG.active, legend: '**Legend:** ◐ active, ✕ blocked, ◆ gate.' })
  )
  assert.match(plain, /1 plans, 0 failed/)
})

it('gate decisions use the fixed wording', async () => {
  const gates = lines => plan({}).replace('## Notes\n', `## Notes\n\n### Decisions\n\n${lines.join('\n')}\n`)
  const loose = await check('gate-loose', gates(['- Gate 1: shape looks good', '- Gate 2: done']))
  assert.match(loose, /gate line: line \d+: write "- Gate 1: approved"/)
  assert.match(loose, /gate line: line \d+: write "- Gate 2: held" or "- Gate 2: reshaped <ids>"/)
  const fixed = await check('gate-fixed', gates(['- Gate 1: approved - shape agreed', '- Gate 2: reshaped a, b2']))
  assert.match(fixed, /1 plans, 0 failed/)
})

it('Decisions over the budget warn and never fail; a Confirm checklist is not counted', async () => {
  const decisions = (n, extra = '') =>
    plan({}).replace(
      '## Notes\n',
      `## Notes\n\n### Decisions\n\n${Array.from({ length: n }, (_, i) => `- d${i}`).join('\n')}\n${extra}`
    )
  const over = await check('decisions-over', decisions(31))
  assert.match(over, /WARN p\.md\n\s+decisions budget warn: Decisions: 31 lines/)
  assert.match(over, /1 plans, 0 failed/)
  const under = await check('decisions-under', decisions(20))
  assert.doesNotMatch(under, /decisions budget/)
  const confirm = await check(
    'decisions-confirm',
    decisions(20, `\n#### Confirm after the push\n\n${Array.from({ length: 15 }, (_, i) => `- c${i}`).join('\n')}\n`)
  )
  assert.doesNotMatch(confirm, /decisions budget/)
})

it('a table whose divider row does not match its header fails', async () => {
  const out = await check(
    'divider',
    plan({}).replace('| ---- | ---- | --------- |', '| ---- | ---- | --------- | --- |')
  )
  assert.match(out, /table divider: line 11: the header has 3 cells, the divider row has 4/)
  assert.match(out, /1 plans, 1 failed/)
  const escaped = '| A | B |\n| - | - |\n| x \\| y | z |\n'
  assert.match(await check('divider-ok', plan({}).replace('## Notes\n', `## Notes\n\n${escaped}`)), /1 plans, 0 failed/)
})

it('bold in a plain label fails; a markdown label passes', async () => {
  const out = await check('bold-plain', plan({ dag: 'flowchart TD\n a["**a** test"]' }))
  assert.match(out, /bold label: fence at line 3: "\*\*a\*\* test" shows its \*\* marks/)
  assert.match(await check('bold-md', plan({ dag: 'flowchart TD\n a["`**a** test`"]' })), /1 plans, 0 failed/)
})

it('a node table without a Done when column fails', async () => {
  const out = await check('no-done-when', plan({}).replace(/ Done when \|/, ' Effort |'))
  assert.match(out, /done when: line \d+: the node table needs a "Done when" column/)
  assert.match(out, /1 plans, 1 failed/)
})
