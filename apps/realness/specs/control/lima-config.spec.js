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
  assert.match(
    filled,
    /- location: "\/Users\/person x\/realness\/vault"\n\s+mountPoint: \/host\/vault\n/
  )
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

it('the VM is sized for a box and a Chrome copy at once', async () => {
  const { BOX_CPUS, BOX_MIB } = await import('../../src/halo/box.js')
  const { COPY_VCPUS, DEFAULT_MIB } =
    await import('../../src/halo/chrome-pool.js')
  const value = key =>
    Number(
      template.match(new RegExp(`^${key}: (\\d+)`, 'm'))?.[1] ??
        template.match(new RegExp(`^${key}: (\\d+)GiB`, 'm'))?.[1]
    )
  const mib = value('memory') * 1024
  assert.ok(mib >= BOX_MIB + DEFAULT_MIB + 1024, 'memory leaves the halo a GiB')
  assert.ok(value('cpus') >= BOX_CPUS + COPY_VCPUS, 'cpus avoid a squeeze')
})
