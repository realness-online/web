import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { Storage } from '@google-cloud/storage'
import { OAuth2Client } from 'google-auth-library'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mirror_copy } from '#services/mirror-copy.js'
import { mirror_delete } from '#services/mirror-delete.js'

/**
 * Real Cloud Storage, because the emulator ignores generation preconditions.
 * Runs only with GCS_TEST_TOKEN (gcloud auth print-access-token) and only
 * against the development bucket, inside a unique prefix it deletes after.
 */
const token = process.env.GCS_TEST_TOKEN
const BUCKET = 'realness-development.appspot.com'

describe.skipIf(!token)('mirror guards on real Cloud Storage (development)', () => {
  let bucket
  const prefix = `people/+0-guard-test-${randomUUID()}/`
  beforeAll(() => {
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: token })
    bucket = new Storage({ projectId: 'realness-development', authClient: auth }).bucket(BUCKET)
    if (bucket.name !== BUCKET) throw new Error('Development bucket only')
  })
  afterAll(async () => {
    await bucket.deleteFiles({ prefix, force: true })
    const [left] = await bucket.getFiles({ prefix })
    if (left.length) throw new Error(`Test objects left behind: ${left.length}`)
  })

  const save = (name, metadata = {}) => bucket.file(name).save(gzipSync('<p>poster</p>'.repeat(8)), {
    resumable: false,
    metadata: { contentType: 'text/html; charset=utf-8', contentEncoding: 'gzip', metadata }
  })
  const head = async name => (await bucket.file(name).getMetadata())[0]
  const revisions = object => ({
    generation: String(object.generation), metageneration: String(object.metageneration)
  })
  const pair = () => {
    const old = `${prefix}${randomUUID()}.html.gz`
    return { old, current: old.replace(/\.gz$/, '') }
  }

  it('copies bytes and metadata into an absent counterpart, once', async () => {
    const { old, current } = pair()
    await save(old, { hash: 'abc', sold: 'true' })
    const source = revisions(await head(old))
    const copy = () => mirror_copy({
      bucket, name: old, source_generation: source.generation,
      source_metageneration: source.metageneration, target_generation: '0'
    })
    await copy()
    const target = await head(current)
    expect(target.md5Hash).toBe((await head(old)).md5Hash)
    expect(target.contentEncoding).toBe('gzip')
    expect(target.metadata).toMatchObject({ hash: 'abc', sold: 'true' })
    await expect(copy()).rejects.toMatchObject({ code: 412 })
  }, 30_000)

  it('refuses to overwrite a counterpart whose bytes changed', async () => {
    const { old, current } = pair()
    await save(old)
    await save(current)
    const [source, target] = [revisions(await head(old)), revisions(await head(current))]
    await save(current, { edited: 'bytes' })
    await expect(mirror_copy({
      bucket, name: old, source_generation: source.generation,
      source_metageneration: source.metageneration,
      target_generation: target.generation, target_metageneration: target.metageneration
    })).rejects.toMatchObject({ code: 412 })
    expect((await head(current)).metadata).toMatchObject({ edited: 'bytes' })
  }, 30_000)

  it('refuses to overwrite a counterpart whose metadata changed, such as a sale', async () => {
    const { old, current } = pair()
    await save(old)
    await save(current)
    const [source, target] = [revisions(await head(old)), revisions(await head(current))]
    await bucket.file(current).setMetadata({ metadata: { sold: 'true' } })
    await expect(mirror_copy({
      bucket, name: old, source_generation: source.generation,
      source_metageneration: source.metageneration,
      target_generation: target.generation, target_metageneration: target.metageneration
    })).rejects.toMatchObject({ code: 412 })
    expect((await head(current)).metadata).toMatchObject({ sold: 'true' })
  }, 30_000)

  it('refuses to copy a source revision that has since changed', async () => {
    const { old } = pair()
    await save(old)
    const stale = revisions(await head(old))
    await save(old, { newer: 'yes' })
    await expect(mirror_copy({
      bucket, name: old, source_generation: stale.generation,
      source_metageneration: stale.metageneration, target_generation: '0'
    })).rejects.toMatchObject({ code: 412 })
  }, 30_000)

  it('deletes only the inspected counterpart revision', async () => {
    const { old, current } = pair()
    await save(current)
    const inspected = revisions(await head(current))
    await bucket.file(current).setMetadata({ metadata: { sold: 'true' } })
    await expect(mirror_delete({
      bucket, name: old, target_generation: inspected.generation,
      target_metageneration: inspected.metageneration
    })).rejects.toMatchObject({ code: 412 })
    const now = revisions(await head(current))
    await mirror_delete({
      bucket, name: old, target_generation: now.generation,
      target_metageneration: now.metageneration
    })
    expect((await bucket.file(current).exists())[0]).toBe(false)
  }, 30_000)
})
