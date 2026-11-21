/**
 * k2: the Mac moves an actor's returned changes into its files when they pass
 * the fixed checks, and lists the rest, with reasons, on its waiting page.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { read_items } from '#root/lib/items.js'
import { out_path } from '#root/lib/output.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { admit, WAITING_NOTE } from '#root/src/files/admit.js'
import { reasons_to_wait } from '#root/src/files/admit-checks.js'
import { client } from '#root/src/files/client.js'
import { version_sync } from '#root/src/files/version-node.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { WAITING_PAGE } from '#root/src/sync/quarantine.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'admit-test-secret-at-least-thirty-two-bytes!!'
const issuer = dev_issuer()
const phone = '+15555550100'
const id = 'a-0123456789ab'
const dir = out_path(`admit-test-${random_uuid()}`)
const root = join(dir, 'mac')
const trash = join(dir, 'trash')
let storage
let server
let url

before(async () => {
  await mkdir(join(root, 'vault'), { recursive: true })
  storage = store_of(disk(join(dir, 'bucket')))
  server = sync_service({
    storage,
    rights: rights(storage),
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

const actor = () =>
  client({ url, token: issue_harness_pass({ phone, id }, secret), phone })
const mac = () => client({ url, token: issuer.token(phone), phone })
const on_mac = (path, text) => write_file(join(root, path), text)
const base_of = text => version_sync(Buffer.from(text))
const run = () => admit({ root, store: mac(), phone, trash })

it('a change that passes moves in; the rest wait with their reasons', async () => {
  await on_mac('vault/plan.md', 'start\n')
  await on_mac('vault/stale.md', 'start\n')
  await on_mac('vault/gone.md', 'bye\n')
  const back = actor()
  await back.hand_back(
    'can://~/vault/plan.md',
    Buffer.from('edited\n'),
    base_of('start\n')
  )
  await back.hand_back(
    'can://~/vault/stale.md',
    Buffer.from('theirs\n'),
    base_of('start\n')
  )
  await back.hand_back('can://~/vault/gone.md', null, base_of('bye\n'))
  await back.hand_back(
    'can://~/vault/page.html',
    Buffer.from('<p>hi</p><script>x()</script>'),
    null
  )
  await back.hand_back('can://~/work/demo/a.js', Buffer.from('code\n'), null)
  await on_mac('vault/stale.md', 'mine, since\n')
  const stranger = client({
    url,
    token: issuer.token('+15555550199'),
    phone: '+15555550199'
  })
  await assert.rejects(
    stranger.put(`can://people/${phone}/vault/outside.md`, 'x'),
    { status: 403 }
  )

  const report = await run()
  assert.deepEqual(report.moved.sort(), ['vault/gone.md', 'vault/plan.md'])
  assert.deepEqual(report.waiting.sort(), [
    'vault/page.html',
    'vault/stale.md',
    'work/demo/a.js'
  ])
  assert.equal(await read_file(join(root, 'vault/plan.md'), 'utf8'), 'edited\n')
  assert.equal(
    await read_file(join(root, 'vault/stale.md'), 'utf8'),
    'mine, since\n'
  )
  await assert.rejects(read_file(join(root, 'vault/gone.md')), {
    code: 'ENOENT'
  })
  assert.equal(
    await storage.get(`people/${phone}/quarantine/${id}/vault/plan.md`),
    null
  )

  const page = await read_file(join(root, WAITING_NOTE), 'utf8')
  const why = Object.fromEntries(
    read_items(page, 'waiting').map(item => [item.path, String(item.reasons)])
  )
  assert.match(why['vault/stale.md'], /changed since the actor started/)
  assert.match(why['vault/page.html'], /carries a script/)
  assert.match(why['work/demo/a.js'], /patch/)
  assert.deepEqual(
    read_items(page, 'refusal').map(item => item.path),
    [`people/${phone}/vault/outside.md`]
  )

  const listed = read_items(
    (
      await storage.get(`people/${phone}/quarantine/${WAITING_PAGE}`)
    ).body.toString(),
    'change'
  ).map(item => item.path)
  assert.deepEqual(listed.sort(), [
    'vault/page.html',
    'vault/stale.md',
    'work/demo/a.js'
  ])

  const again = await run()
  assert.deepEqual(again.moved, [])
  assert.equal(again.waiting.length, 3)
})

it('a page keeps its itemid, and a new page names its owner', () => {
  const page = itemid => Buffer.from(`---\nitemid: "${itemid}"\n---\n\n# A\n`)
  const mine = page(`/${phone}/plans/1`)
  const change = {
    path: 'vault/a.md',
    action: 'write',
    base: version_sync(mine)
  }
  assert.deepEqual(
    reasons_to_wait(change, { bytes: mine, local: mine, phone }),
    []
  )
  assert.deepEqual(
    reasons_to_wait(change, {
      bytes: page(`/${phone}/plans/2`),
      local: mine,
      phone
    }),
    ["it changes the page's itemid"]
  )
  assert.deepEqual(
    reasons_to_wait(
      { ...change, base: 'new' },
      { bytes: page('/+15555550199/plans/1'), local: null, phone }
    ),
    ['its itemid names someone else']
  )
})
