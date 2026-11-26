/**
 * c1: the cloud's sync server admits a person's quarantine with the Mac's own
 * code, over the cloud's copy, while the Mac sleeps.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { read_items } from '#root/lib/items.js'
import { out_path } from '#root/lib/output.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { client } from '#root/src/files/client.js'
import { cloud_admitter } from '#root/src/files/local-admit.js'
import { version_sync } from '#root/src/files/version-node.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'cloud-admit-test-secret-at-least-thirty-two!!'
const issuer = dev_issuer()
const phone = '+15555550100'
const id = 'a-0123456789ab'
const dir = out_path(`cloud-admit-test-${random_uuid()}`)
const vault = path => `people/${phone}/${path}`
let storage
let server
let url
let cloud

before(async () => {
  storage = store_of(disk(join(dir, 'bucket')))
  cloud = cloud_admitter({ storage })
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: secret,
    on_hold: owner => cloud.poke(owner),
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise(done => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const halo = () =>
  client({ url, token: issue_harness_pass({ phone, id }, secret), phone })
const base_of = text => version_sync(Buffer.from(text))
const cloud_bytes = async path => (await storage.get(vault(path)))?.body ?? null

/** Wait for the cloud's own run; nothing here starts one. */
const settled = async check => {
  for (let tries = 0; tries < 100; tries++) {
    if (await check()) return
    await new Promise(done => setTimeout(done, 20))
  }
  throw new Error('the cloud did not admit in time')
}

it('a passing change lands in the cloud vault while the Mac sleeps', async () => {
  await storage.put(vault('vault/plan.md'), Buffer.from('start\n'))
  await halo().hand_back(
    'can://~/vault/plan.md',
    Buffer.from('edited\n'),
    base_of('start\n')
  )
  const held = () => storage.get(vault(`quarantine/${id}/vault/plan.md`))
  await settled(
    async () =>
      (await cloud_bytes('vault/plan.md'))?.toString() === 'edited\n' &&
      (await held()) === null
  )
  assert.equal(await held(), null)
})

it('a failing change waits in the cloud quarantine, listed with its reason', async () => {
  await halo().hand_back(
    'can://~/vault/page.html',
    Buffer.from('<p>hi</p><script>x()</script>'),
    null
  )
  const page = () => cloud_bytes('vault/Waiting.html')
  await settled(async () => (await page())?.toString().includes('script'))
  assert.equal(await cloud_bytes('vault/page.html'), null)
  assert.ok(await storage.get(vault(`quarantine/${id}/vault/page.html`)))
  const [waiting] = read_items((await page()).toString(), 'waiting')
  assert.equal(waiting.path, 'vault/page.html')
  assert.match(String(waiting.reasons), /carries a script/)
})

it('a delete moves the cloud copy to the trash', async () => {
  const version = await storage.put(
    vault('vault/gone.md'),
    Buffer.from('bye\n')
  )
  await halo().hand_back('can://~/vault/gone.md', null, version)
  await settled(async () => (await cloud_bytes('vault/gone.md')) === null)
  const kept = Object.keys(await storage.walk(`trash/people/${phone}/`))
  assert.ok(kept.some(name => name.endsWith('vault/gone.md')))
})

it('a change held before the cloud server started lands when it starts', async () => {
  await storage.put(vault('vault/late.md'), Buffer.from('start\n'))
  const quiet = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => quiet.listen(0, '127.0.0.1', done))
  await client({
    url: `http://127.0.0.1:${quiet.address().port}`,
    token: issue_harness_pass({ phone, id }, secret),
    phone
  }).hand_back(
    'can://~/vault/late.md',
    Buffer.from('later\n'),
    base_of('start\n')
  )
  await new Promise(done => quiet.close(done))
  assert.equal((await cloud_bytes('vault/late.md')).toString(), 'start\n')
  await cloud_admitter({ storage }).start()
  assert.equal((await cloud_bytes('vault/late.md')).toString(), 'later\n')
})
