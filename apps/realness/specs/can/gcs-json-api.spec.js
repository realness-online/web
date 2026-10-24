/**
 * The JSON API, answered by a fake fetch. No bucket, no credentials:
 * `create_gcs` takes its bucket and token, and reaches the network only
 * through `fetch`, so every status and page shape is reachable here.
 *
 * The real-bucket contract lives in gcs.test.js and skips without
 * GCS_TEST_BUCKET.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { create_gcs, metadata_token } from '../../src/can/gcs.js'

const store = (over = {}) =>
  create_gcs({ bucket: 'b', token: async () => 't', ...over })

/** Answer each call from `handler`, and record what was asked. */
const routed_fetch = (t, handler) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  })
  return calls
}

const reply = (body, { status = 200, headers = {} } = {}) =>
  new Response(body, { status, headers })

const json = (value, options) => reply(JSON.stringify(value), options)

const list_page = (items, { prefixes, nextPageToken } = {}) =>
  json({ items, prefixes, nextPageToken })

const item = name => ({ name })

/** The object resource `head` reads before a get, a guarded write, or a stat. */
const object = (over = {}) =>
  json({ generation: '7', md5Hash: 'md5==', metadata: {}, ...over })

it('get pins the media read to the generation it read, and 404 is absence', async t => {
  const calls = routed_fetch(t, url =>
    url.includes('alt=media')
      ? reply('body-bytes')
      : object({ metadata: { sold: 'true', size: '10' } })
  )
  const got = await store().get('people/+1/a.md')
  assert.equal(got.body.toString('utf8'), 'body-bytes')
  assert.equal(got.version, 'md5==')
  assert.deepEqual(got.meta, { sold: 'true' })
  assert.match(calls[0].url, /\?fields=generation,md5Hash,crc32c,metadata$/)
  assert.match(
    calls[1].url,
    /\/o\/people%2F%2B1%2Fa\.md\?alt=media&generation=7$/
  )
  assert.equal(calls[0].init.headers.authorization, 'Bearer t')

  routed_fetch(t, () => reply('gone', { status: 404 }))
  assert.equal(await store().get('people/+1/a.md'), null)
})

it('a failed get names the key and carries the status and body', async t => {
  routed_fetch(t, url =>
    url.includes('alt=media')
      ? reply('permission denied', { status: 403 })
      : object()
  )
  await assert.rejects(
    store().get('people/+1/a.md'),
    /gcs get .*: 403 permission denied/
  )
})

it('stat returns the hash, CRC32C for a composed object, or nothing', async t => {
  routed_fetch(t, () => object())
  assert.equal(await store().stat('a.md'), 'md5==')

  routed_fetch(t, () => object({ md5Hash: undefined, crc32c: 'c==' }))
  assert.equal(await store().stat('a.md'), 'crc32c-c==')

  routed_fetch(t, () => reply('', { status: 404 }))
  assert.equal(await store().stat('a.md'), null)
})

it('put returns the hash and asks for it with a media upload', async t => {
  const calls = routed_fetch(t, () => json({ generation: '9', md5Hash: 'h==' }))
  assert.equal(await store().put('people/+1/a.bin', Buffer.from('x')), 'h==')
  assert.match(
    calls[0].url,
    /^https:\/\/storage\.googleapis\.com\/upload\/storage\/v1\/b\/b\/o\?/
  )
  assert.match(calls[0].url, /uploadType=media/)
  assert.match(calls[0].url, /name=people%2F%2B1%2Fa\.bin/)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(
    calls[0].init.headers['content-type'],
    'application/octet-stream'
  )
})

it('put with meta sends it as the object metadata', async t => {
  const calls = routed_fetch(t, () => json({ md5Hash: 'h==' }))
  await store().put('people/+1/p.bin', Buffer.from('x'), {
    meta: { sold: 'true' }
  })
  assert.match(calls[0].url, /uploadType=multipart/)
  assert.match(
    calls[0].init.body.toString('latin1'),
    /"metadata":\{"sold":"true"\}/
  )
})

it('text long enough to shrink is stored gzip and the query says so', async t => {
  const calls = routed_fetch(t, () => json({ generation: '1' }))
  await store().put('people/+1/notes.md', '# Notes\n'.repeat(50))
  assert.match(calls[0].url, /uploadType=multipart/)
  assert.match(
    calls[0].init.body.toString('latin1'),
    /"contentEncoding":"gzip"/
  )
})

it('text too short to shrink is stored as given', async t => {
  const calls = routed_fetch(t, () => json({ generation: '1' }))
  await store().put('people/+1/tiny.md', 'hi')
  assert.doesNotMatch(calls[0].url, /contentEncoding/)
  assert.equal(calls[0].init.body, 'hi')
})

it('if_absent is generation zero; if_version pins the generation it read', async t => {
  const calls = routed_fetch(t, url =>
    url.includes('/upload/') ? json({ md5Hash: 'next==' }) : object()
  )
  await store().put('a.md', 'x', { if_absent: true })
  await store().put('a.md', 'x', { if_version: 'md5==' })
  assert.match(calls[0].url, /ifGenerationMatch=0/)
  assert.match(calls[2].url, /ifGenerationMatch=7/)
})

it('a hash that moved is a conflict before anything is written', async t => {
  const calls = routed_fetch(t, () => object())
  await assert.rejects(
    store().put('a.md', 'x', { if_version: 'old==' }),
    /a\.md changed/
  )
  assert.equal(calls.length, 1)
})

it('a generation that moved between read and write is a conflict', async t => {
  routed_fetch(t, url =>
    url.includes('/upload/') ? reply('precondition', { status: 412 }) : object()
  )
  await assert.rejects(
    store().put('a.md', 'x', { if_version: 'md5==' }),
    /a\.md changed/
  )
})

it('compose joins on the server and names every source with the prefix', async t => {
  const calls = routed_fetch(t, () => json({ generation: '5', crc32c: 'c==' }))
  assert.equal(
    await store({ prefix: 'p/' }).compose('a.md', ['one.gz', 'two.gz']),
    'crc32c-c=='
  )
  const sent = JSON.parse(calls[0].init.body)
  assert.deepEqual(sent.sourceObjects, [
    { name: 'p/one.gz' },
    { name: 'p/two.gz' }
  ])
  assert.equal(sent.destination.contentEncoding, 'gzip')
  assert.match(calls[0].url, /\/o\/p%2Fa\.md\/compose$/)
})

it('compose maps its three failure statuses by name', async t => {
  routed_fetch(t, () => reply('', { status: 412 }))
  await assert.rejects(store().compose('a.md', []), /a\.md changed/)

  routed_fetch(t, () => reply('', { status: 404 }))
  await assert.rejects(store().compose('a.md', []), /a\.md changed/)

  routed_fetch(t, () => reply('', { status: 429 }))
  await assert.rejects(store().compose('a.md', []), error => {
    assert.equal(error.code, 'busy')
    return true
  })
})

it('delete ignores a missing object unless a version was expected', async t => {
  const calls = routed_fetch(t, () => reply(null, { status: 204 }))
  await store().delete('a.md')
  assert.equal(calls[0].init.method, 'DELETE')
  assert.doesNotMatch(calls[0].url, /ifGenerationMatch/)

  routed_fetch(t, () => reply('', { status: 404 }))
  await store().delete('a.md')

  routed_fetch(t, () => reply('', { status: 404 }))
  await assert.rejects(
    store().delete('a.md', { if_version: 'md5==' }),
    /a\.md changed/
  )

  routed_fetch(t, url =>
    url.includes('ifGenerationMatch') ? reply('', { status: 404 }) : object()
  )
  await assert.rejects(
    store().delete('a.md', { if_version: 'md5==' }),
    /a\.md is gone/
  )
})

it('list separates files from folders, strips the scope, and sorts', async t => {
  const calls = routed_fetch(t, () =>
    list_page([item('p/people/+1/b.md'), item('p/people/+1/a.md')], {
      prefixes: ['p/people/+1/sub/']
    })
  )
  assert.deepEqual(await store({ prefix: 'p/' }).list('people/+1'), {
    files: ['a.md', 'b.md'],
    folders: ['sub']
  })
  assert.match(calls[0].url, /prefix=p%2Fpeople%2F%2B1%2F/)
})

it('list follows nextPageToken to the last page', async t => {
  const pages = [
    list_page([item('p/a.md')], { nextPageToken: 'p2' }),
    list_page([item('p/b.md')])
  ]
  const calls = routed_fetch(t, () => pages.shift())
  assert.deepEqual(await store({ prefix: 'p/' }).list(''), {
    files: ['a.md', 'b.md'],
    folders: []
  })
  assert.equal(calls.length, 2)
  assert.match(calls[1].url, /pageToken=p2/)
})

it('walk maps a name to its hash and skips folder markers', async t => {
  routed_fetch(t, () =>
    list_page([
      { name: 'p/a.md', md5Hash: 'a==' },
      { name: 'p/sub/', md5Hash: 'b==' }
    ])
  )
  assert.deepEqual(await store({ prefix: 'p/' }).walk(''), { 'a.md': 'a==' })
})

it('walk_meta adds size, the last update, and meta', async t => {
  routed_fetch(t, () =>
    list_page([
      {
        name: 'p/a.md',
        md5Hash: 'a==',
        size: '2048',
        updated: '2026-10-01T00:00:00Z',
        metadata: { sold: 'true' }
      }
    ])
  )
  assert.deepEqual(await store({ prefix: 'p/' }).walk_meta(''), {
    'a.md': {
      version: 'a==',
      size: 2048,
      updated: '2026-10-01T00:00:00Z',
      meta: { sold: 'true' }
    }
  })
})

it('a failed listing says which folder failed', async t => {
  routed_fetch(t, () => reply('no such bucket', { status: 404 }))
  await assert.rejects(
    store().list('people'),
    /gcs list people: 404 no such bucket/
  )
})

it('create_gcs refuses a missing bucket, token, or trailing slash', () => {
  assert.throws(() => create_gcs({}), /needs a bucket/)
  assert.throws(() => create_gcs({ bucket: 'b' }), /needs token\(\)/)
  assert.throws(
    () => create_gcs({ bucket: 'b', token: () => 't', prefix: 'p' }),
    /prefix must end in \//
  )
})

it('the metadata token is cached until a minute before it expires', async t => {
  const calls = routed_fetch(t, () =>
    json({ access_token: 'a-token', expires_in: 3600 })
  )
  const token = metadata_token()
  assert.equal(await token(), 'a-token')
  assert.equal(await token(), 'a-token')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers['Metadata-Flavor'], 'Google')
})

it('a metadata token refusal names its status', async t => {
  routed_fetch(t, () => reply('', { status: 403 }))
  await assert.rejects(metadata_token()(), /metadata token: 403/)
})
