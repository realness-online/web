/**
 * hs-f2: once a halo is fenced, sync refuses the passes it minted and its
 * record writes, so a returning halo cannot write over recovered actors.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import {
  issue_harness_pass,
  issue_recovery_pass
} from '#root/src/sign-on/node/recovery-pass.js'
import { issue_record_pass } from '#root/src/sign-on/node/halo-pass.js'
import { out_path } from '#root/lib/output.js'
import { rights } from '../../src/sync/rights.js'
import { fence_reader, sync_service } from '../../src/sync/server.js'

const secret = 'fence-test-secret-at-least-thirty-two-bytes!'
const record_key = 'b'.repeat(64)
const phone = '+14155550188'
const id = 'a-f2f2f2f2f2f2'
const dir = out_path(`fence-test-${randomUUID()}`)
let storage, server, url

const put = (path, token) =>
  fetch(`${url}/${path}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    body: 'x'
  })

before(async () => {
  await mkdir(dir, { recursive: true })
  storage = disk(join(dir, 'bucket'))
  await storage.put('halo-keys/old-halo', record_key)
  await storage.put('halo-keys/new-halo', record_key)
  await storage.put('halo-fences/old-halo', '{"halo":"old-halo"}')
  server = sync_service({
    storage,
    rights: rights(storage),
    project: 'none',
    certs: async () => ({}),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise(done => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const harness_file = `people/${phone}/harness/notes.md`

test('a fenced halo cannot write through the passes it minted', async () => {
  const fenced = issue_harness_pass({ phone, id, halo: 'old-halo' }, secret)
  assert.equal((await put(harness_file, fenced)).status, 401)
  const reading = issue_recovery_pass({ phone, id, halo: 'old-halo' }, secret)
  const response = await fetch(`${url}/${harness_file}`, {
    headers: { authorization: `Bearer ${reading}` }
  })
  assert.equal(response.status, 401)
})

test('the halo that took over writes the same harness', async () => {
  const live = issue_harness_pass({ phone, id, halo: 'new-halo' }, secret)
  assert.equal((await put(harness_file, live)).status, 200)
})

test('passes from before the halo claim keep working', async () => {
  const older = issue_harness_pass({ phone, id }, secret)
  assert.equal((await put(harness_file, older)).status, 200)
})

test('a fenced halo cannot write its record', async () => {
  const fenced = issue_record_pass('old-halo', record_key)
  assert.equal((await put('halos/old-halo/status.html', fenced)).status, 401)
  const live = issue_record_pass('new-halo', record_key)
  assert.notEqual((await put('halos/new-halo/status.html', live)).status, 401)
})

test('fence reads are cached briefly, then read again', async () => {
  let clock = 0
  let reads = 0
  const counted = {
    get: async key => {
      reads += 1
      return key === 'halo-fences/a' ? { body: Buffer.from('{}') } : null
    }
  }
  const fenced = fence_reader(counted, () => clock)
  assert.equal(await fenced('a'), true)
  assert.equal(await fenced('a'), true)
  assert.equal(reads, 1)
  clock = 10_001
  assert.equal(await fenced('a'), true)
  assert.equal(reads, 2)
  assert.equal(await fenced(null), false)
  assert.equal(reads, 2)
})

test('a halo fence revokes authority', async () => {
  const fenced = fence_reader({
    get: async key =>
      key === 'halo-fences/a' ? { body: Buffer.from('{}') } : null
  })
  assert.equal(await fenced('a'), true)
  assert.equal(await fenced('b'), false)
})

test('a gate pass reaches only its halo lifecycle and the placements', async () => {
  const { issue_gate_pass } =
    await import('#root/src/sign-on/node/gate-pass.js')
  const gate = issue_gate_pass('new-halo', secret)
  assert.equal((await put('halos/new-halo/lifecycle.html', gate)).status, 200)
  const read = await fetch(`${url}/halos/new-halo/lifecycle.html`, {
    headers: { authorization: `Bearer ${gate}` }
  })
  assert.equal(read.status, 200)
  assert.equal((await put('placements/14155550188.html', gate)).status, 200)
  for (const path of [
    'halos/old-halo/lifecycle.html',
    'halos/new-halo/status.html',
    `people/${phone}/harness/notes.md`,
    'placements/nested/x.html',
    'halo-keys/new-halo'
  ])
    assert.equal((await put(path, gate)).status, 403, path)
  const listing = await fetch(`${url}/placements/`, {
    headers: { authorization: `Bearer ${gate}` }
  })
  assert.equal(listing.status, 403)
})
