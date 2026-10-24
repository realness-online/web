import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, rmSync as rm_sync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_root } from '#root/lib/output.js'

const scratch = new URL(
  '../../../../artifacts/realness/out-test/',
  import.meta.url
).pathname

it('a harness gets its artifacts and a halo keeps dist', () => {
  rm_sync(scratch, { recursive: true, force: true })
  const harness = join(scratch, 'harness')
  const project = join(harness, 'work', 'realness')
  mkdir_sync(project, { recursive: true })
  mkdir_sync(join(harness, 'artifacts'))
  const host = join(scratch, 'home', 'user', 'realness')
  mkdir_sync(host, { recursive: true })
  try {
    assert.equal(
      out_root({ root: project }),
      join(harness, 'artifacts', 'realness')
    )
    assert.equal(out_root({ root: host }), join(host, 'dist'))
  } finally {
    rm_sync(scratch, { recursive: true, force: true })
  }
})
