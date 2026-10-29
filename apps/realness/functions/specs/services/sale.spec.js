import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { record_sale } from '#services/sale.js'

const { bucket, objects } = vi.hoisted(() => ({
  bucket: { file: vi.fn(), getFiles: vi.fn() },
  objects: new Map()
}))
vi.mock('#utils/firebase.js', () => ({ bucket }))

const id = '/+123/posters/456'
const name = 'people/+123/posters/456.html.gz'
const sale = { amount: 10000, session_id: 'cs_1', date: '2026-10-28' }

const poster_html = `<svg itemscope itemid="${id}"><title>Poster</title></svg>`

beforeEach(() => {
  objects.clear()
  objects.set(name, {
    body: poster_html,
    metadata: { cacheControl: 'no-cache', metadata: { fullLocale: 'en-US' } }
  })
  bucket.file.mockReset()
  bucket.file.mockImplementation(key => ({
    name: key,
    exists: async () => [objects.has(key)],
    download: async () => {
      const object = objects.get(key)
      return [Buffer.from(object.body)]
    },
    getMetadata: async () => [objects.get(key).metadata],
    setMetadata: async update => {
      const object = objects.get(key)
      object.metadata = { ...object.metadata, ...update }
    },
    save: async (body, options) => {
      objects.set(key, { body, metadata: options.metadata })
    }
  }))
  bucket.getFiles.mockResolvedValue([[{ name }]])
})

describe('record_sale on sync storage', () => {
  it('writes gzip bytes with sync version and size metadata', async () => {
    expect(await record_sale(id, sale)).toBe(true)
    const written = objects.get(name)
    const html = gunzipSync(written.body).toString('utf8')
    expect(html).toContain('itemprop="sale"')
    expect(html).toContain('cs_1')
    expect(written.metadata.contentEncoding).toBe('gzip')
    expect(written.metadata.metadata.sold).toBe('true')
    expect(written.metadata.metadata.fullLocale).toBe('en-US')
    expect(written.metadata.metadata.size).toBe(String(Buffer.byteLength(html)))
    expect(written.metadata.metadata.version).toBe(
      createHash('sha256').update(html).digest('base64url').slice(0, 22)
    )
    expect(written.metadata.metadata.hash).toBe(
      createHash('sha256').update(html).digest('base64')
    )
  })

  it('updates the plain copy too while it exists', async () => {
    objects.set('people/+123/posters/456.html', {
      body: poster_html,
      metadata: {}
    })
    await record_sale(id, sale)
    const plain = objects.get('people/+123/posters/456.html')
    expect(gunzipSync(plain.body).toString()).toContain('cs_1')
    expect(plain.metadata.metadata.version).toBeUndefined()
    expect(plain.metadata.metadata.sold).toBe('true')
  })

  it('does not duplicate a sale and marks both copies sold', async () => {
    await record_sale(id, sale)
    objects.set('people/+123/posters/456.html', {
      body: poster_html,
      metadata: {}
    })
    delete objects.get(name).metadata.metadata.sold
    expect(await record_sale(id, sale)).toBe(false)
    expect(objects.get(name).metadata.metadata.sold).toBe('true')
    expect(
      objects.get('people/+123/posters/456.html').metadata.metadata.sold
    ).toBe('true')
  })
})
