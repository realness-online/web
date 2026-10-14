/**
 * `brayness fold`: keep-both session copies merge back into one file,
 * locally and in storage, against a real sync service on disk.
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { disk } from '#root/src/can/disk.js'
import { client } from '#root/src/files/client.js'
import { fold_conflicts } from '#root/src/harness/fold.js'
import { sync_harness } from '#root/src/harness/harness.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const A = '+15555550100'
const root = new URL(
  `../../../../artifacts/brayness/fold-test-${randomUUID()}/`,
  import.meta.url
).pathname
const issuer = dev_issuer()
let server
let store

before(async () => {
  process.env.BRAYNESS_STATE = join(root, 'state')
  process.env.BRAYNESS_TRASH = join(root, 'trash')
  const storage = disk(join(root, 'bucket'))
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  store = client({
    url: `http://127.0.0.1:${server.address().port}`,
    token: issuer.token(A)
  })
})
after(async () => {
  server.close()
  await rm(root, { recursive: true, force: true })
})

const rows = (...entries) =>
  entries.map(entry => `${JSON.stringify(entry)}\n`).join('')
const head = {
  type: 'session',
  id: 's',
  version: 3,
  cwd: '/x',
  timestamp: '2026-10-09T00:00:00.000Z'
}
const say = (id, text) => ({
  type: 'message',
  id,
  parentId: null,
  timestamp: '2026-10-09T00:00:00.000Z',
  message: { role: 'user', content: [{ type: 'text', text }] }
})

test('fold merges every copy into its original, here and in storage', async () => {
  const harness = join(root, 'h')
  const sessions = join(harness, '.pi/agent/sessions/--x--')
  await mkdir(sessions, { recursive: true })
  await writeFile(join(harness, '.ignore'), '')
  await writeFile(join(sessions, 'a.jsonl'), rows(head, say('e1', 'one')))
  await writeFile(
    join(sessions, 'a.conflict.jsonl'),
    rows(head, say('e2', 'two'))
  )
  await writeFile(
    join(sessions, 'a.conflict-2.jsonl'),
    rows(head, say('e1', 'one'), say('e3', 'three'))
  )
  await writeFile(join(sessions, 'b.conflict.jsonl'), 'not a session\n')
  await writeFile(join(sessions, 'b.jsonl'), rows(head))
  await sync_harness({ root: harness, store, plans: [] })
  assert.ok(
    (await store.walk('can://~/harness/.pi/agent/sessions/'))[
      '--x--/a.conflict.jsonl'
    ]
  )

  const dry = await fold_conflicts({
    root: harness,
    store,
    state: join(root, 'state'),
    dry_run: true
  })
  assert.deepEqual(dry, {
    folded: ['--x--/a.conflict-2.jsonl', '--x--/a.conflict.jsonl'],
    left: ['--x--/b.conflict.jsonl']
  })
  assert.equal((await readdir(sessions)).length, 5, 'a dry run touches nothing')

  const report = await fold_conflicts({
    root: harness,
    store,
    state: join(root, 'state')
  })
  assert.deepEqual(report.folded, dry.folded)
  assert.deepEqual((await readdir(sessions)).sort(), [
    'a.jsonl',
    'b.conflict.jsonl',
    'b.jsonl'
  ])
  assert.equal(
    await readFile(join(sessions, 'a.jsonl'), 'utf8'),
    rows(head, say('e1', 'one'), say('e3', 'three'), say('e2', 'two'))
  )
  assert.equal(
    (await readdir(join(root, 'trash'))).length,
    2,
    'copies go to the Trash'
  )
  const remote = await store.walk('can://~/harness/.pi/agent/sessions/')
  assert.equal(remote['--x--/a.conflict.jsonl'], undefined)
  assert.equal(remote['--x--/a.conflict-2.jsonl'], undefined)

  const after_fold = await sync_harness({ root: harness, store, plans: [] })
  assert.deepEqual(after_fold.harness.sessions.pushed, ['--x--/a.jsonl'])
  assert.deepEqual(after_fold.harness.sessions.kept_both, [])
  assert.equal(
    (
      await store.cat('can://~/harness/.pi/agent/sessions/--x--/a.jsonl')
    ).toString(),
    await readFile(join(sessions, 'a.jsonl'), 'utf8')
  )
})
