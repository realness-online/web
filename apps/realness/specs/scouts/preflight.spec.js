import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { FREE_BYTES, scout_preflight } from '#root/src/scouts/preflight.js'
import { run_scout } from '#root/src/scouts/run.js'
import { scout_page } from '#root/src/scouts/scout.js'
import { GIB } from '#root/lib/units.js'

/** A chrome pool that records what a preflight did to it. */
const pool_of = calls => ({
  restore: async () => {
    calls.push('restore')
    return { n: 3 }
  },
  destroy: async n => calls.push(`destroy ${n}`)
})

it('a run needs free space before it makes a copy', async () => {
  const calls = []
  await assert.rejects(
    scout_preflight({
      store: { free_bytes: () => GIB },
      chrome: { pool: pool_of(calls) }
    }),
    /1 GiB free; a run needs 2/
  )
  assert.deepEqual(calls, [])
})

it('a halo with no chrome pool cannot start a run', async () => {
  await assert.rejects(
    scout_preflight({ store: { free_bytes: () => FREE_BYTES }, chrome: null }),
    /no chrome pool/
  )
})

it('a copy is made and destroyed, so a run inherits no lease', async () => {
  const calls = []
  const result = await scout_preflight({
    store: { free_bytes: () => 8 * GIB },
    chrome: { pool: pool_of(calls) }
  })
  assert.equal(result.free, 8 * GIB)
  assert.deepEqual(calls, ['restore', 'destroy 3'])
})

/** A failed gate stops the run before a folder or a pi is made. */
it('a failed preflight writes nothing and starts no pi', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scout-gate-'))
  const folder = join(root, 'vault/Projects/Scouts/Realness')
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'scout.html'),
    scout_page('Realness', {
      itemid: '/+1/scouts/realness',
      org: '+1',
      schedule: 'daily',
      minutes: 30,
      per_day: 1,
      status: 'active'
    })
  )
  await writeFile(join(folder, 'Profile.md'), '# profile\n')
  await writeFile(join(folder, 'Sources.md'), '# sources\n')
  let spawned = false
  await assert.rejects(
    run_scout({
      scout: 'realness',
      vault_dir: join(root, 'vault'),
      person: '/+1',
      date: '2026-11-05',
      preflight: async () => {
        throw new Error('the actors volume is full')
      },
      spawn_pi: async () => {
        spawned = true
      }
    }),
    /is full/
  )
  assert.equal(spawned, false)
  assert.equal(existsSync(join(folder, 'Runs')), false)
})
