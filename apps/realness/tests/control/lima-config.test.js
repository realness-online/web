import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { render_vm_config } from '../../src/control/lima.js'

const template = read_file_sync(
  join(import.meta.dirname, '../../server/lima/fc-local.yaml'),
  'utf8'
)

test('the Lima template names no checkout; both mounts are filled from this one', () => {
  assert.doesNotMatch(template, /\/Users\/|\/home\//)
  const filled = render_vm_config(template, {
    project: '/Users/person x/realness/apps/realness',
    out: '/Users/person x/realness/artifacts/brayness'
  })
  assert.match(
    filled,
    /- location: "\/Users\/person x\/realness\/apps\/realness"\n\s+mountPoint: \/mnt\/fc\n/
  )
  assert.match(
    filled,
    /- location: "\/Users\/person x\/realness\/artifacts\/brayness"\n\s+mountPoint: \/artifacts\/brayness\n/
  )
  assert.doesNotMatch(filled, /\{\{|""/)
})

test('a relative folder or an unknown placeholder is refused', () => {
  assert.throws(
    () =>
      render_vm_config(template, { project: 'apps/realness', out: '/tmp/out' }),
    /absolute path/
  )
  assert.throws(
    () => render_vm_config('x: {{home}}', { project: '/p', out: '/o' }),
    /unknown placeholder \{\{home\}\}/
  )
})
