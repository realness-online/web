import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { after, before, it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { read_status, HaloStatus } from '../../src/halo/status.js'
import { SyncMirror } from '../../src/halo/sync-mirror.js'
import { out_path } from '#root/lib/output.js'

const secret = 'test-secret-123456789012345678901234567890'
const issuer = dev_issuer()
const dir = out_path(`sync-mirror-test-${randomUUID()}`)
const storage = disk(dir)
let server, url

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put('halo-keys/realness-1', secret)
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: 'phone-secret-12345678901234567890123456789',
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const store = {
  volume: '/',
  seedStatus: () => ({ built: true, matches: true }),
  list: () => []
}

it('halo status reaches storage through sync, with no storage key', async () => {
  const mirror = new SyncMirror({ url, secret, halo: 'realness-1' })
  assert.equal(
    await new HaloStatus(store, { mirror, halo: 'realness-1' }).publish(),
    true
  )
  const stored = await storage.get('halos/realness-1/status.html')
  assert.equal(
    read_status(stored.body.toString('utf8')).halo.name,
    'realness-1'
  )
})

it('loop records write, and a missing stop request reads as null', async () => {
  const mirror = new SyncMirror({ url, secret, halo: 'realness-1' })
  await mirror.put('loops/a-0123456789ab/record.html', '<article></article>')
  assert.equal(await mirror.get('loops/a-0123456789ab/stop.html'), null)
  await storage.put('loops/a-0123456789ab/stop.html', 'stop')
  assert.equal(
    (await mirror.get('loops/a-0123456789ab/stop.html')).body.toString(),
    'stop'
  )
})

it("a halo cannot write another halo's status, and a wrong secret is refused", async () => {
  const mirror = new SyncMirror({ url, secret, halo: 'realness-1' })
  await assert.rejects(
    mirror.put('halos/realness-2/status.html', 'forged'),
    /403/
  )
  const stranger = new SyncMirror({
    url,
    secret: 'another-secret-1234567890123456789012345',
    halo: 'realness-1'
  })
  await assert.rejects(stranger.put('halos/realness-1/status.html', 'x'), /401/)
})
