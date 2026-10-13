import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, rmSync as rm_sync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { out_root } from '#root/lib/output.js'

const scratch = new URL('../../../../artifacts/brayness/out-test/', import.meta.url).pathname

test('BRAYNESS_OUT wins, a harness gets its artifacts, a host keeps dist', () => {
  rm_sync(scratch, { recursive: true, force: true })
  const harness = join(scratch, 'harness')
  const project = join(harness, 'work', 'brayness')
  mkdir_sync(project, { recursive: true })
  mkdir_sync(join(harness, 'artifacts'))
  const host = join(scratch, 'home', 'user', 'brayness')
  mkdir_sync(host, { recursive: true })
  try {
    assert.equal(out_root({ env: { BRAYNESS_OUT: '/elsewhere' }, root: project }), '/elsewhere')
    assert.equal(out_root({ env: {}, root: project }), join(harness, 'artifacts', 'brayness'))
    assert.equal(out_root({ env: {}, root: host }), join(host, 'dist'))
  } finally {
    rm_sync(scratch, { recursive: true, force: true })
  }
})
