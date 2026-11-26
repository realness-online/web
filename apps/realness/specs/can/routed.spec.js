import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { disk } from '../../src/can/disk.js'
import { routed } from '../../src/can/routed.js'
import { store_of } from '../../src/can/store.js'
import { hold_change } from '../../src/sync/quarantine.js'
import { hold_refused, keep_refusal } from '../../src/sync/refusals.js'

const A = '+14155550001'
const PREFIX = `people/${A}/quarantine/`
const dirs = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

/** The sync store and the Mac's quarantine folder, each in a fresh folder. */
const stores = () => {
  const sync = mkdtempSync(join(tmpdir(), 'routed-sync-'))
  const held = mkdtempSync(join(tmpdir(), 'routed-held-'))
  dirs.push(sync, held)
  const storage = routed(store_of(disk(sync)), PREFIX, disk(held))
  return { sync, held, storage }
}

it('a quarantined write lands plain in the other folder', async () => {
  const { sync, held, storage } = stores()
  await storage.put(`${PREFIX}halo-1/vault/note.md`, Buffer.from('hi'))
  assert.equal(readFileSync(join(held, 'halo-1/vault/note.md'), 'utf8'), 'hi')
  assert.equal(existsSync(join(sync, 'people', A, 'quarantine')), false)
  const read = await storage.get(`${PREFIX}halo-1/vault/note.md`)
  assert.equal(read.body.toString(), 'hi')
})

it('every other key stays in the sync store', async () => {
  const { sync, held, storage } = stores()
  await storage.put(`people/${A}/vault/note.md`, Buffer.from('hi'))
  assert.ok(existsSync(join(sync, 'people', A, 'vault', 'note.md.gz')))
  assert.equal(existsSync(join(held, 'vault')), false)
})

it('an actor change, held by the server code, lands in the folder', async () => {
  const { held, storage } = stores()
  await hold_change({
    storage,
    owner: A,
    rest: 'vault/plan.md',
    action: 'write',
    who: { harness: 'halo-1' },
    body: Buffer.from('# plan'),
    base: 'abc'
  })
  assert.equal(
    readFileSync(join(held, 'halo-1/vault/plan.md'), 'utf8'),
    '# plan'
  )
  const waiting = readFileSync(join(held, 'Waiting.html'), 'utf8')
  assert.match(waiting, /itemprop="base">abc</)
  assert.match(waiting, /itemprop="actor">halo-1</)
})

it('a refusal keeps its bytes and its page in the folder', async () => {
  const { held, storage } = stores()
  const who = { harness: 'halo-1' }
  const kept = await hold_refused({
    storage,
    body: Buffer.from('no'),
    path: `people/${A}/vault/b.md`,
    owner: A,
    who
  })
  await keep_refusal({
    storage,
    owner: A,
    entry: { path: `people/${A}/vault/b.md`, action: 'write', who, held: kept }
  })
  assert.equal(readFileSync(join(held, 'halo-1/vault/b.md'), 'utf8'), 'no')
  assert.match(readFileSync(join(held, 'Refusals.html'), 'utf8'), /halo-1/)
  assert.deepEqual(
    readdirSync(held).filter(name => name.startsWith('.')),
    []
  )
})

it('a person listing shows the quarantine folder', async () => {
  const { storage } = stores()
  await storage.put(`people/${A}/vault/note.md`, Buffer.from('hi'))
  await storage.put(`${PREFIX}halo-1/vault/note.md`, Buffer.from('hi'))
  const { folders } = await storage.list(`people/${A}/`)
  assert.deepEqual(folders.sort(), ['quarantine', 'vault'])
  assert.deepEqual((await storage.list(PREFIX)).folders, ['halo-1'])
})

it('a walk from above holds files from both stores', async () => {
  const { storage } = stores()
  await storage.put(`people/${A}/vault/note.md`, Buffer.from('one'))
  await storage.put(`${PREFIX}halo-1/vault/note.md`, Buffer.from('two'))
  const found = Object.keys(await storage.walk(`people/${A}/`)).sort()
  assert.deepEqual(found, ['quarantine/halo-1/vault/note.md', 'vault/note.md'])
  const inside = Object.keys(await storage.walk(PREFIX))
  assert.deepEqual(inside, ['halo-1/vault/note.md'])
})

it('a delete reaches the quarantine folder', async () => {
  const { held, storage } = stores()
  await storage.put(`${PREFIX}halo-1/vault/note.md`, Buffer.from('hi'))
  await storage.delete(`${PREFIX}halo-1/vault/note.md`)
  assert.equal(existsSync(join(held, 'halo-1/vault/note.md')), false)
})
