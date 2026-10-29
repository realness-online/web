import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdtempSync as mkdtemp_sync, rmSync as rm_sync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  LAYOUT_BYTES,
  read_layout,
  write_layout
} from '../../src/halo/layout.js'

const dir = () => mkdtemp_sync(join(tmpdir(), 'layout-'))

it('a saved layout comes back; none saved is null', () => {
  const at = dir()
  assert.equal(read_layout(at), null)
  const layout = {
    split: 'row',
    panes: [{ session: null }, { session: 'logs' }]
  }
  assert.deepEqual(write_layout(at, layout), layout)
  assert.deepEqual(read_layout(at), layout)
  rm_sync(at, { recursive: true, force: true })
})

it('only a small JSON object is a layout', () => {
  const at = dir()
  for (const bad of [null, 'row', 5, ['a']])
    assert.throws(() => write_layout(at, bad), /JSON object/)
  assert.throws(
    () => write_layout(at, { pad: 'x'.repeat(LAYOUT_BYTES) }),
    /larger than/
  )
  assert.equal(read_layout(at), null)
  rm_sync(at, { recursive: true, force: true })
})
