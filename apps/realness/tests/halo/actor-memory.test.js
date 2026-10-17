import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { ActorStore, ACTOR_MIB } from '#root/src/halo/actors.js'
import { out_path } from '#root/lib/output.js'

const seed_for = (t, record_mib) => {
  mkdir_sync(out_path('actor-memory-tests'), { recursive: true })
  const root = mkdtemp_sync(join(out_path('actor-memory-tests'), 'seed-'))
  t.after(() => rm_sync(root, { recursive: true, force: true }))
  const template = join(root, 'template.ext4')
  write_file_sync(template, 'template')
  const seedDir = join(root, 'seed')
  mkdir_sync(seedDir)
  write_file_sync(join(seedDir, 'state'), '')
  const store = {
    seedDir,
    template,
    kernel: '/opt/fc/vmlinux-6.1.155',
    firecrackerVersion: 'Firecracker v1.17.0',
    vcpus: 2,
    mib: ACTOR_MIB
  }
  store.cheapFingerprint = ActorStore.prototype.cheapFingerprint.bind(store)
  const current = store.cheapFingerprint()
  const record = { ...current }
  if (record_mib === undefined) delete record.mem_size_mib
  else record.mem_size_mib = record_mib
  write_file_sync(join(seedDir, 'seed.json'), JSON.stringify(record))
  return ActorStore.prototype.seedStatus.call(store)
}

test('actors default to the measured 768 MiB guest', () => {
  assert.equal(ACTOR_MIB, 768)
})

test('a seed snapshotted at another memory size is rebuilt', t => {
  const status = seed_for(t, 512)
  assert.equal(status.matches, false)
  assert.deepEqual(status.mismatches, ['mem_size_mib: 512 != 768'])
})

test('a seed from before memory was fingerprinted is rebuilt', t => {
  assert.equal(seed_for(t, undefined).matches, false)
})

test('a seed at the configured memory size is reused', t => {
  assert.equal(seed_for(t, ACTOR_MIB).matches, true)
})
