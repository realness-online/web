/**
 * k3: an actor works on its start copy and returns what it changed. Every
 * change waits in quarantine with the version it started from; the vault
 * itself never moves.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { it } from 'node:test'
import { read_items } from '#root/lib/items.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { version_sync } from '#root/src/files/version-node.js'
import { actor_client } from '#root/src/harness/actor.js'
import { return_files } from '#root/src/harness/return.js'
import { write_start_copy } from '#root/src/harness/start-copy.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { WAITING_PAGE } from '#root/src/sync/quarantine.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'actor-sync-test-secret-at-least-thirty-two-bytes'
const phone = '+14155550123'
const id = 'a-abcdef123456'

it('an actor returns its changes to quarantine, renewing an expired pass', async () => {
  const directory = new URL(
    `../../../../artifacts/realness/actor-return-${randomUUID()}/`,
    import.meta.url
  ).pathname
  const root = join(directory, 'actor')
  const state = join(directory, 'actor-state')
  await mkdir(join(root, 'vault'), { recursive: true })
  await mkdir(state, { recursive: true })
  await writeFile(join(root, 'vault/note.md'), 'original\n')
  await writeFile(join(root, 'vault/gone.md'), 'old\n')
  await write_start_copy(root, state)
  const storage = store_of(disk(join(directory, 'storage')))
  await storage.put(`people/${phone}/vault/note.md`, 'original\n')
  const server = sync_service({
    storage,
    rights: rights(storage),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}`
  let issued = 0
  const issue = async () =>
    issue_harness_pass(
      { phone, id },
      secret,
      issued++ ? Date.now() : Date.now() - 600_000
    )
  try {
    const { store } = await actor_client({ url, issue, state })
    await writeFile(join(root, 'vault/note.md'), 'actor change\n')
    await writeFile(join(root, 'vault/new.md'), 'made here\n')
    await rm(join(root, 'vault/gone.md'))
    const report = await return_files({ root, state, store })
    assert.equal(issued, 2, 'an expired pass is replaced')
    assert.deepEqual(report.written.sort(), ['vault/new.md', 'vault/note.md'])
    assert.deepEqual(report.deleted, ['vault/gone.md'])
    assert.equal(
      (await storage.get(`people/${phone}/vault/note.md`)).body.toString(),
      'original\n'
    )
    assert.equal(
      (
        await storage.get(`people/${phone}/quarantine/${id}/vault/note.md`)
      ).body.toString(),
      'actor change\n'
    )
    const page = await storage.get(`people/${phone}/quarantine/${WAITING_PAGE}`)
    const waiting = read_items(page.body.toString(), 'change')
    const by_path = Object.fromEntries(waiting.map(item => [item.path, item]))
    assert.equal(
      by_path['vault/note.md'].base,
      version_sync(Buffer.from('original\n'))
    )
    assert.equal(by_path['vault/new.md'].base, 'new')
    assert.equal(by_path['vault/gone.md'].action, 'delete')
    const again = await return_files({ root, state, store })
    assert.deepEqual(again, { written: [], deleted: [], refused: [] })
  } finally {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
    await rm(directory, { recursive: true, force: true })
  }
})
