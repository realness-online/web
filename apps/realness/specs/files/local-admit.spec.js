/**
 * l3: the local sync server admits the Mac's quarantine itself. A local
 * halo hands back a change; with no command run, a passing one is in the
 * vault and a failing one waits, kept in `quarantine/`, beside `vault/`.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { existsSync as exists_sync } from 'node:fs'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { read_items } from '#root/lib/items.js'
import { out_path } from '#root/lib/output.js'
import { disk } from '#root/src/can/disk.js'
import { routed } from '#root/src/can/routed.js'
import { store_of } from '#root/src/can/store.js'
import { WAITING_NOTE } from '#root/src/files/admit.js'
import { client } from '#root/src/files/client.js'
import { local_admitter, owner_store } from '#root/src/files/local-admit.js'
import { version_sync } from '#root/src/files/version-node.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'local-admit-test-secret-at-least-thirty-two!!'
const issuer = dev_issuer()
const phone = '+15555550100'
const id = 'a-0123456789ab'
const dir = out_path(`local-admit-test-${random_uuid()}`)
const root = join(dir, 'mac')
const held = join(root, 'quarantine')
const trash = join(dir, 'trash')
let server
let url
let admitter
let storage

before(async () => {
  await mkdir(join(root, 'vault'), { recursive: true })
  storage = routed(
    store_of(disk(join(dir, 'sync'))),
    `people/${phone}/quarantine/`,
    disk(held)
  )
  admitter = local_admitter({ storage, owner: phone, root, trash })
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: secret,
    on_hold: owner => admitter.poke(owner),
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
/** Wait for the server's own run; nothing here starts one. */
const settled = async () => {
  for (let tries = 0; tries < 100; tries++) {
    if (exists_sync(join(root, WAITING_NOTE))) {
      await new Promise(done => setTimeout(done, 20))
      return
    }
    await new Promise(done => setTimeout(done, 20))
  }
}
const fresh = () => rm(join(root, WAITING_NOTE), { force: true })

it('a passing change lands in the vault with no command run', async () => {
  await write_file(join(root, 'vault/plan.md'), 'start\n')
  await fresh()
  await halo().hand_back(
    'can://~/vault/plan.md',
    Buffer.from('edited\n'),
    base_of('start\n')
  )
  await settled()
  assert.equal(await read_file(join(root, 'vault/plan.md'), 'utf8'), 'edited\n')
  assert.equal(exists_sync(join(held, id, 'vault/plan.md')), false)
})

it('a failing change waits in the Mac quarantine, listed with its reason', async () => {
  await fresh()
  await halo().hand_back(
    'can://~/vault/page.html',
    Buffer.from('<p>hi</p><script>x()</script>'),
    null
  )
  await settled()
  assert.equal(exists_sync(join(root, 'vault/page.html')), false)
  assert.ok(exists_sync(join(held, id, 'vault/page.html')))
  const page = await read_file(join(root, WAITING_NOTE), 'utf8')
  const [waiting] = read_items(page, 'waiting')
  assert.equal(waiting.path, 'vault/page.html')
  assert.match(String(waiting.reasons), /carries a script/)
})

it('changes that land during a run start one more run after it', async () => {
  const runs = []
  let release
  const slow = local_admitter({
    storage,
    owner: phone,
    root,
    trash,
    run: () => {
      runs.push(runs.length)
      return runs.length === 1
        ? new Promise(done => {
            release = () => done({ moved: [], waiting: [] })
          })
        : { moved: [], waiting: [] }
    }
  })
  const first = slow.poke(phone)
  slow.poke(phone)
  slow.poke(phone)
  release()
  await first
  assert.equal(runs.length, 2)
})

it('a change held before the server started lands when it starts', async () => {
  const quiet = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => quiet.listen(0, '127.0.0.1', done))
  const quiet_url = `http://127.0.0.1:${quiet.address().port}`
  await write_file(join(root, 'vault/late.md'), 'start\n')
  await client({
    url: quiet_url,
    token: issue_harness_pass({ phone, id }, secret),
    phone
  }).hand_back(
    'can://~/vault/late.md',
    Buffer.from('later\n'),
    base_of('start\n')
  )
  await new Promise(done => quiet.close(done))
  assert.equal(await read_file(join(root, 'vault/late.md'), 'utf8'), 'start\n')
  await local_admitter({ storage, owner: phone, root, trash }).start()
  assert.equal(await read_file(join(root, 'vault/late.md'), 'utf8'), 'later\n')
})

it('another owner never starts a run', async () => {
  let runs = 0
  const one = local_admitter({
    storage,
    owner: phone,
    root,
    trash,
    run: async () => {
      runs += 1
      return { moved: [], waiting: [] }
    }
  })
  await one.poke('+15555550199')
  assert.equal(runs, 0)
})

it('a moved page refuses a stale guarded write as sync does', async () => {
  const store = owner_store(storage, phone)
  await store.put('can://~/quarantine/x.html', Buffer.from('one'))
  await assert.rejects(
    store.put('can://~/quarantine/x.html', Buffer.from('two'), {
      'if-match': '"stale"'
    }),
    { status: 412 }
  )
  await assert.rejects(store.cat('can://~/quarantine/none.html'), {
    status: 404
  })
  await assert.rejects(
    store.rm('can://~/quarantine/x.html', { 'if-match': '"stale"' }),
    { status: 412 }
  )
  assert.equal(
    (await storage.get(`people/${phone}/quarantine/x.html`)).body.toString(),
    'one'
  )
})
