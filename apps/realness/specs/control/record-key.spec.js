import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, stat, mkdir, rm } from 'node:fs/promises'
import { after, before, it } from 'node:test'
import { join } from 'node:path'
import { provision_record_key } from '../../src/control/halo-gcp.js'
import { out_path } from '#root/lib/output.js'

const scratch = out_path(`record-key-test-${randomUUID()}`)
const key = 'a'.repeat(64)
const config = {
  root: '~/realness',
  project: 'realness-online',
  storage: 'realness-online.appspot.com'
}
const calls = []
const cloud = {
  call: async argv => {
    calls.push(argv)
    return `${key}\n`
  }
}

before(() => mkdir(scratch, { recursive: true }))
after(() => rm(scratch, { recursive: true, force: true }))

it("operator registers the halo key in sync's bucket, then removes the local copy", async () => {
  let saved
  await provision_record_key(cloud, config, 'realness-1', {
    scratch,
    upload: async (file, destination) => {
      saved = {
        file,
        destination,
        body: await readFile(file, 'utf8'),
        mode: (await stat(file)).mode & 0o777
      }
    }
  })
  assert.deepEqual(calls.at(-1), [
    'ssh',
    'realness-1',
    '--quiet',
    '--command=sudo bash ~/realness/server/halo/scripts/record-key.sh'
  ])
  assert.equal(
    saved.destination,
    'gs://realness-online.appspot.com/halo-keys/realness-1'
  )
  assert.equal(saved.body, key)
  assert.equal(saved.mode, 0o600)
  assert.deepEqual(await readdir(scratch), [])
})

it('failed registration removes the local copy; bad names never reach SSH', async () => {
  const prior = calls.length
  await assert.rejects(
    provision_record_key(cloud, config, '../other', { scratch }),
    /invalid halo name/
  )
  assert.equal(calls.length, prior)
  await assert.rejects(
    provision_record_key(cloud, config, 'realness-1', {
      scratch,
      upload: async () => {
        throw new Error('upload failed')
      }
    }),
    /upload failed/
  )
  assert.deepEqual(await readdir(scratch), [])
})

it('a bad key returned by SSH is not registered', async () => {
  const bad = { call: async () => 'not a key' }
  await assert.rejects(
    provision_record_key(bad, config, 'realness-1', { scratch }),
    /invalid/
  )
  assert.deepEqual(await readdir(scratch), [])
})

it('a config without project or storage registers nothing', async () => {
  const prior = calls.length
  await assert.rejects(
    provision_record_key(cloud, { root: '~/realness' }, 'realness-1', {
      scratch
    }),
    /needs project and storage/
  )
  assert.equal(calls.length, prior)
})

it('revoke fences the halo where sync reads it, then drops its record key', async () => {
  const { revoke } = await import('../../src/control/halo-gcp.js')
  const { store_of } = await import('#root/src/can/store.js')
  const { disk } = await import('#root/src/can/disk.js')
  const bucket = join(scratch, 'bucket')
  const store = store_of(disk(bucket))
  await store.put('halo-keys/realness-1', key)
  const result = await revoke(config, 'realness-1', {
    store,
    now: () => '2026-10-15T00:00:00.000Z'
  })
  assert.deepEqual(result, { halo: 'realness-1', fenced: true })
  assert.deepEqual(
    JSON.parse((await store.get('halo-fences/realness-1')).body.toString()),
    { halo: 'realness-1', revoked_at: '2026-10-15T00:00:00.000Z' }
  )
  assert.equal(await store.get('halo-keys/realness-1'), null)
  assert.ok(await stat(join(bucket, 'halo-fences/realness-1.gz')))
  await assert.rejects(revoke(config, '../x', { store }), /invalid halo name/)
})
