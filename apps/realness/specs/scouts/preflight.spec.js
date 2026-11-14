import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import {
  FREE_BYTES,
  box_ready,
  scout_preflight
} from '#root/src/scouts/preflight.js'
import { run_scout } from '#root/src/scouts/run.js'
import { scout_page } from '#root/src/scouts/scout.js'
import { GIB } from '#root/lib/units.js'

it('a run needs free space before any loop starts', () => {
  assert.throws(
    () => scout_preflight({ store: { free_bytes: () => GIB } }),
    /1 GiB free; a run needs 2/
  )
})

it('a run with room passes the gate', () => {
  const result = scout_preflight({ store: { free_bytes: () => 8 * GIB } })
  assert.equal(result.free, 8 * GIB)
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

it('a Mac has no model pass command and is ready', async () => {
  const missing = Object.assign(new Error('spawn'), { code: 'ENOENT' })
  assert.equal(
    await box_ready(async () => {
      throw missing
    }),
    'mac'
  )
})

it('a box is ready only when the halo issues it a pass', async () => {
  assert.equal(await box_ready(async () => ({ stdout: 'eyJ\n' })), 'box')
  await assert.rejects(
    box_ready(async () => ({ stdout: '\n' })),
    /empty model pass/
  )
  const refused = Object.assign(new Error('exit 1'), {
    code: 1,
    stderr: 'realness-model-pass: the halo door did not issue a model pass\n'
  })
  await assert.rejects(
    box_ready(async () => {
      throw refused
    }),
    /the halo issued no model pass: realness-model-pass: the halo door/
  )
})
