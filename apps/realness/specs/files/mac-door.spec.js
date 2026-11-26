/**
 * G6: the Mac's door. A hash changes, the cloud's quarantine comes down, the
 * change is admitted, and the Mac's vault holds it with no command run.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { existsSync as exists_sync } from 'node:fs'
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { WAITING_NOTE } from '#root/src/files/admit.js'
import { client } from '#root/src/files/client.js'
import { mac_door } from '#root/src/files/mac-door.js'
import { version_sync } from '#root/src/files/version-node.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { out_path } from '#root/lib/output.js'

const secret = 'mac-door-test-secret-at-least-thirty-two!!'
const issuer = dev_issuer()
const phone = '+15555550100'
const id = 'a-0123456789ab'
const dir = out_path(`mac-door-test-${random_uuid()}`)
const root = join(dir, 'mac')
const quarantine = join(root, 'quarantine')
const trash = join(dir, 'trash')
const record = join(dir, 'state/two-way.json')
let server
let url
let store

before(async () => {
  await mkdir(join(root, 'vault'), { recursive: true })
  await mkdir(quarantine, { recursive: true })
  store = store_of(disk(join(dir, 'sync')))
  server = sync_service({
    storage: store,
    rights: rights(store),
    project: issuer.project,
    certs: issuer.certs,
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

const halo = () =>
  client({ url, token: issue_harness_pass({ phone, id }, secret), phone })
const base_of = text => version_sync(Buffer.from(text))
const door = () => mac_door({ root, store, phone, record, trash })

it('a changed hash pulls the change down and the vault holds it', async () => {
  await write_file(join(root, 'vault/plan.md'), 'start\n')
  await halo().hand_back(
    'can://~/vault/plan.md',
    Buffer.from('edited in the cloud\n'),
    base_of('start\n')
  )
  const { pulled, admitted } = await door()
  assert.ok(pulled.pulled.includes(`quarantine/${id}/vault/plan.md`))
  assert.deepEqual(admitted.moved, ['vault/plan.md'])
  assert.equal(
    await read_file(join(root, 'vault/plan.md'), 'utf8'),
    'edited in the cloud\n'
  )
  assert.equal(
    await store.get(`people/${phone}/quarantine/${id}/vault/plan.md`),
    null
  )
})

it('a refused change waits on the Mac, listed with its reason', async () => {
  await rm(join(root, WAITING_NOTE), { force: true })
  await halo().hand_back(
    'can://~/vault/page.html',
    Buffer.from('<p>hi</p><script>x()</script>'),
    null
  )
  const { pulled, admitted } = await door()
  assert.deepEqual(admitted.waiting, ['vault/page.html'])
  assert.deepEqual(pulled.deleted, [`quarantine/${id}/vault/plan.md`])
  assert.equal(exists_sync(join(quarantine, id, 'vault/plan.md')), false)
  assert.equal(exists_sync(join(quarantine, id, 'vault/page.html')), true)
  assert.match(
    await read_file(join(root, WAITING_NOTE), 'utf8'),
    /carries a script/
  )
})

it('a further pass moves nothing and deletes nothing', async () => {
  const { pulled, admitted } = await door()
  assert.deepEqual(admitted.moved, [])
  assert.deepEqual(pulled.deleted, [])
})
