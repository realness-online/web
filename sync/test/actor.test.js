import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { disk } from 'brayness-can-store/disk'
import { sync_actor } from '../src/actor.js'
import { client } from '../src/client.js'
import { issue_harness_pass } from '../src/recovery-pass.js'
import { rights } from '../src/rights.js'
import { sync_service } from '../src/server.js'

const secret = 'actor-sync-test-secret-at-least-thirty-two-bytes'
const phone = '+14155550123'
const id = 'a-abcdef123456'

test('an actor edit reaches a desktop through normal sync, renewing an expired pass', async () => {
  const directory = new URL(`../../../../artifacts/brayness/actor-sync-${randomUUID()}/`, import.meta.url).pathname
  const root = join(directory, 'actor')
  await mkdir(join(root, 'vault'), { recursive: true })
  await writeFile(join(root, '.ignore'), '')
  await writeFile(join(root, 'vault/note.md'), 'original\n')
  const storage = disk(join(directory, 'storage'))
  const server = sync_service({ storage, rights: rights(storage), host_pass_secret: secret, log: () => {} })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}`
  const state = join(directory, 'actor-state')
  let issued = 0
  const issue = () => issue_harness_pass({ phone, id }, secret, issued++ ? Date.now() : Date.now() - 600_000)
  try {
    await sync_actor({ url, root, state, issue })
    assert.equal(issued, 2, 'an expired pass is replaced without saving a token')
    const desktop = join(directory, 'desktop')
    const store = client({ url, token: issue_harness_pass({ phone, id }, secret), phone })
    const options = { state: join(directory, 'desktop-state') }
    await store.sync(desktop, 'can://~/harness/', options)
    assert.equal(await readFile(join(desktop, 'vault/note.md'), 'utf8'), 'original\n')
    await writeFile(join(root, 'vault/note.md'), 'actor change\n')
    await sync_actor({ url, root, state, issue })
    await store.sync(desktop, 'can://~/harness/', options)
    assert.equal(await readFile(join(desktop, 'vault/note.md'), 'utf8'), 'actor change\n')
    await mkdir(join(root, 'apps/blog'), { recursive: true })
    await writeFile(join(root, 'apps/blog/post.md'), 'limited change\n')
    const limited = () => issue_harness_pass({ phone, id, paths: ['apps/blog'] }, secret)
    await sync_actor({ url, root, state, issue: limited })
    assert.equal((await storage.get(`people/${phone}/harness/apps/blog/post.md`)).body.toString(), 'limited change\n')
  } finally {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
    await rm(directory, { recursive: true, force: true })
  }
})
