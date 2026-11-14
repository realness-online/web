/**
 * v3c: the commands page reads as rows, whatever the page writes.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  command_count,
  command_groups,
  command_row
} from '#root/src/sync/vault-commands.js'

const ITEM =
  '<li><header><h3>Realness watch</h3><span>CLI command - Realness</span></header>' +
  '<p><strong>Keep</strong> - Live health and spend.</p>' +
  '<p><code>realness watch</code><button type="button" value="node bin/realness.js watch">Copy</button></p>' +
  '<details><summary>Source and details</summary><p>Live health.</p><p>--interval &lt;seconds&gt;</p>' +
  '<p>Source: <code>a/b.js</code></p></details></li>'

const PAGE = `<html><body><div id="command-list">
<section id="group-0"><h2>Monitor</h2><ul>${ITEM}</ul></section>
<section id="group-1"><h2>Build</h2><ul>${ITEM.replace('Realness watch', 'build')}</ul></section>
</div></body></html>`

it('reads a command row: title, kind, review, note, command, and details', () => {
  assert.deepEqual(command_row(ITEM), {
    title: 'Realness watch',
    kind: 'CLI command - Realness',
    review: 'Keep',
    note: 'Live health and spend.',
    command: 'realness watch',
    details: ['Live health.', '--interval <seconds>', 'Source: a/b.js']
  })
})

it('reads the groups in the page order, and counts every row', () => {
  const groups = command_groups(PAGE)
  assert.deepEqual(
    groups.map(group => [group.name, group.rows.length]),
    [
      ['Monitor', 1],
      ['Build', 1]
    ]
  )
  assert.equal(command_count(PAGE), 2)
  assert.deepEqual(command_groups('<html></html>'), [])
})
