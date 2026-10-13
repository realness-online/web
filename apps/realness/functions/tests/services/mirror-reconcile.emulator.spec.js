import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mirror_journal } from '#services/mirror-journal.js'
import { mirror_reconcile } from '#services/mirror-reconcile.js'

const storage_host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
const firestore_host = process.env.FIRESTORE_EMULATOR_HOST
const loopback = host => /^127\.0\.0\.1:\d+$/.test(host || '')

describe.skipIf(!storage_host || !firestore_host)('mirror on Storage and Firestore emulators', () => {
  let app, bucket, journal
  beforeAll(() => {
    if (!loopback(storage_host) || !loopback(firestore_host))
      throw new Error('Loopback emulators required')
    process.env.STORAGE_EMULATOR_HOST = `http://${storage_host}`
    app = initializeApp({
      projectId: 'demo-realness-migration', storageBucket: 'demo-realness-migration.appspot.com'
    }, `mirror-${randomUUID()}`)
    bucket = getStorage(app).bucket()
    journal = mirror_journal({ db: getFirestore(app) })
  })
  afterAll(async () => {
    await bucket.deleteFiles({ prefix: 'people/' }).catch(() => {})
    await deleteApp(app)
  })

  const html = '<article itemid="/+1/posters/1">poster</article>'.repeat(8)
  const save = (name, metadata = {}) => bucket.file(name).save(gzipSync(html), {
    resumable: false,
    metadata: { contentType: 'text/html; charset=utf-8', contentEncoding: 'gzip', metadata }
  })
  const head = async name => {
    const [exists] = await bucket.file(name).exists()
    return exists ? (await bucket.file(name).getMetadata())[0] : null
  }

  it('copies an old-name write with bytes and metadata, then settles', async () => {
    const old = `people/+1/posters/${Date.now()}.html.gz`
    const current = old.replace(/\.gz$/, '')
    await save(old, { hash: 'abc', sold: 'true' })
    const result = await mirror_reconcile({ bucket, journal, name: old })
    expect(result.action).toBe('settled')
    const [source, target] = [await head(old), await head(current)]
    expect(target.md5Hash).toBe(source.md5Hash)
    expect(target.contentEncoding).toBe('gzip')
    expect(target.metadata).toMatchObject({ hash: 'abc', sold: 'true' })
    expect((await mirror_reconcile({ bucket, journal, name: current })).action).toBe('settled')
  }, 30_000)

  it('migrates a bucket from a report, and a rerun changes nothing', async () => {
    const { migration_report } = await import('#services/migration-report.js')
    const { migration_apply } = await import('#services/migration-apply.js')
    const base = `people/+4/posters/${Date.now()}`
    const names = [`${base}.html.gz`, `${base}-rocks.html.gz`, `${base}0/archive.html.gz`]
    // eslint-disable-next-line no-await-in-loop -- seed in order
    for (const name of names) await save(name, { hash: name })
    const report = async () => {
      const [files] = await bucket.getFiles({ prefix: 'people/+4/' })
      return migration_report(files.map(file => file.metadata))
    }
    const run = async () => migration_apply({
      rows: await report(), reconcile: name => mirror_reconcile({ bucket, journal, name })
    })
    expect(await run()).toEqual({ counts: { settled: 3 }, failures: [] })
    for (const name of names)
      // eslint-disable-next-line no-await-in-loop -- check each copy
      expect((await head(name.replace(/\.gz$/, ''))).metadata).toMatchObject({ hash: name })
    expect((await report()).every(row => row.status === 'matched')).toBe(true)
    expect(await run()).toEqual({ counts: {}, failures: [] })
  }, 60_000)

  it('propagates an acknowledged delete to the unchanged counterpart', async () => {
    const old = `people/+2/posters/${Date.now()}.html.gz`
    const current = old.replace(/\.gz$/, '')
    await save(old)
    await mirror_reconcile({ bucket, journal, name: old })
    const { generation } = await head(old)
    await bucket.file(old).delete()
    const result = await mirror_reconcile({
      bucket, journal, name: old, deletion: { name: old, generation: String(generation) }
    })
    expect(result.action).toBe('settled')
    expect(await head(current)).toBeNull()
  }, 30_000)

  it.skip('rejects a copy over a counterpart changed after inspection', async () => {
    const old = `people/+3/posters/${Date.now()}.html.gz`
    const current = old.replace(/\.gz$/, '')
    await save(old)
    await save(current)
    const { mirror_copy } = await import('#services/mirror-copy.js')
    const [source, target] = [await head(old), await head(current)]
    await save(current, { edited: 'yes' })
    await expect(mirror_copy({
      bucket, name: old,
      source_generation: String(source.generation),
      source_metageneration: String(source.metageneration),
      target_generation: String(target.generation),
      target_metageneration: String(target.metageneration)
    })).rejects.toMatchObject({ status: 412 })
    expect((await head(current)).metadata).toMatchObject({ edited: 'yes' })
  }, 30_000)
})
