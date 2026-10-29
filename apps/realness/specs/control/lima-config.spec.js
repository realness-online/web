import assert from 'node:assert/strict'
import { it } from 'node:test'
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { render_vm_config } from '../../src/control/lima.js'

const template = read_file_sync(
  join(import.meta.dirname, '../../server/lima/fc-local.yaml'),
  'utf8'
)

it('the Lima template names no checkout; every mount is filled from this one', () => {
  assert.doesNotMatch(template, /\/Users\/|\/home\//)
  const filled = render_vm_config(template, {
    project: '/Users/person x/realness/apps/realness',
    out: '/Users/person x/realness/artifacts/realness',
    sync: '/Users/person x/Realness-sync',
    vault: '/Users/person x/realness/vault'
  })
  assert.match(
    filled,
    /- location: "\/Users\/person x\/realness\/apps\/realness"\n\s+mountPoint: \/mnt\/fc\n/
  )
  assert.match(
    filled,
    /- location: "\/Users\/person x\/realness\/artifacts\/realness"\n\s+mountPoint: \/artifacts\/realness\n/
  )
  assert.match(
    filled,
    /- location: "\/Users\/person x\/Realness-sync"\n\s+mountPoint: \/sync-data\n/
  )
  assert.doesNotMatch(filled, /host\/vault/)
  assert.doesNotMatch(filled, /\{\{|""/)
})

it('a relative folder or an unknown placeholder is refused', () => {
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
