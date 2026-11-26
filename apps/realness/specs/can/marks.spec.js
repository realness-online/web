import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { disk } from '../../src/can/disk.js'
import { read_sync_hash, folder_of, SYNC_HASH } from '../../src/can/marks.js'
import { store_of } from '../../src/can/store.js'

const A = '+14155550001'
const dirs = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

const store = () => {
  const root = mkdtempSync(join(tmpdir(), 'marks-'))
  dirs.push(root)
  const bytes = disk(root)
  return {
    storage: store_of(bytes, { marks: true, wait: 60_000 }),
    page: () => store_of(bytes)
  }
}

const page_of = async storage => {
  const read = await storage.get(`people/${A}/${SYNC_HASH}`)
  return read ? read_sync_hash(read.body.toString()) : null
}

it('names the folder a key marks', () => {
  assert.deepEqual(folder_of(`people/${A}/vault/Plans/a.md`), {
    person: A,
    folder: 'vault/Plans'
  })
  assert.deepEqual(folder_of(`people/${A}/vault/note.md`), {
    person: A,
    folder: 'vault'
  })
  assert.deepEqual(folder_of(`people/${A}/quarantine/x/vault/a.md`), {
    person: A,
    folder: 'quarantine'
  })
  assert.equal(folder_of(`people/${A}/sync-hash.html`), null)
  assert.equal(folder_of('server/admins.html'), null)
})

it('a write marks its folder; a flush writes the page', async () => {
  const { storage, page } = store()
  assert.equal(await page_of(page()), null)
  await storage.put(`people/${A}/vault/Plans/a.md`, Buffer.from('one'))
  assert.equal(await page_of(page()), null)
  await storage.flush()
  const written = await page_of(page())
  assert.equal(written.quarantine, '')
  assert.equal(Object.keys(written.folders).length, 1)
  assert.match(written.vault, /^[0-9a-f]{64}$/)
})

it('a second write to the same folder keeps one entry; the hash changes', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/vault/Plans/a.md`, Buffer.from('one'))
  await storage.flush()
  const first = await page_of(page())
  await storage.put(`people/${A}/vault/Plans/a.md`, Buffer.from('two'))
  await storage.flush()
  const second = await page_of(page())
  assert.deepEqual(Object.keys(second.folders), Object.keys(first.folders))
  assert.notEqual(second.folders['vault/Plans'], first.folders['vault/Plans'])
  assert.notEqual(second.vault, first.vault)
})

it('the quarantine hash stands apart and ignores vault writes', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/quarantine/halo/vault/a.md`, Buffer.from('q'))
  await storage.flush()
  const first = await page_of(page())
  assert.match(first.quarantine, /^[0-9a-f]{64}$/)
  assert.equal(first.vault, '')
  await storage.put(`people/${A}/vault/b.md`, Buffer.from('v'))
  await storage.flush()
  const second = await page_of(page())
  assert.equal(second.quarantine, first.quarantine)
  assert.notEqual(second.vault, '')
})

it('the page never hashes itself', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/vault/a.md`, Buffer.from('one'))
  await storage.flush()
  const first = await page_of(page())
  await storage.flush()
  assert.deepEqual(await page_of(page()), first)
  const walked = Object.keys(await page().walk(`people/${A}/`))
  assert.deepEqual(walked.sort(), [SYNC_HASH, 'vault/a.md'])
  const listed = await page().list(`people/${A}/`)
  assert.deepEqual(listed.folders, ['vault'])
})

it('a delete marks the folder too', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/vault/Plans/a.md`, Buffer.from('one'))
  await storage.flush()
  const first = await page_of(page())
  await storage.delete(`people/${A}/vault/Plans/a.md`)
  await storage.flush()
  const second = await page_of(page())
  assert.equal(second.folders['vault/Plans'], undefined)
  assert.notEqual(second.vault, first.vault)
})

it('a rebuild repairs marks lost to a crash', async () => {
  const { storage, page } = store()
  await page().put(`people/${A}/vault/Plans/a.md`, Buffer.from('one'))
  await page().put(`people/${A}/quarantine/halo/vault/a.md`, Buffer.from('q'))
  assert.equal(await page_of(page()), null)
  await storage.rebuild(A)
  const written = await page_of(page())
  assert.deepEqual(Object.keys(written.folders), ['vault/Plans'])
  assert.match(written.quarantine, /^[0-9a-f]{64}$/)
})

it('two writers keep both folds, the later one retried', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/vault/a.md`, Buffer.from('one'))
  await storage.put(`people/${A}/vault/Plans/b.md`, Buffer.from('two'))
  await storage.flush()
  const written = await page_of(page())
  assert.deepEqual(Object.keys(written.folders).sort(), [
    'vault',
    'vault/Plans'
  ])
})

it('a marked store still hides names and stores .gz keys', async () => {
  const { storage, page } = store()
  await storage.put(`people/${A}/vault/a.md`, Buffer.from('one'))
  await storage.flush()
  const listed = await page().list(`people/${A}/vault/`)
  assert.deepEqual(listed.files, ['a.md'])
  const root = await page().list(`people/${A}/`)
  assert.deepEqual(root.files, [SYNC_HASH])
})
