import { gzipSync as gzip_sync } from 'node:zlib'
import { version_of } from '#root/src/files/version.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- writes are ordered so the change feed sees them in order */
/**
 * Options every adapter accepts on a write.
 *
 * `if_version` is the version the caller last read; the write lands only
 * while the stored bytes still hash to it. `if_absent: true` creates only
 * when the key is missing. Neither writes without a precondition.
 * @typedef {{ if_version?: string, if_absent?: boolean }} VersionGuard
 */

/**
 * What we know about the data that its bytes cannot say. A put replaces it;
 * leaving it out stores none. Values are strings. `created`, an ISO time,
 * is the exception: it keeps the earliest ever put, and survives a put
 * without one.
 * @typedef {{ meta?: Record<string, string> }} Described
 */

/** A write whose precondition no longer holds. */
export class Conflict extends Error {
  code = 'conflict'
}

/** The earlier of two ISO times; either may be missing. */
/** Enough repeats that a body is worth compressing. */
const REPEATS = 40

const text = file => file?.body.toString('utf8')

const earliest = (a, b) => {
  if (!a) return b
  if (!b) return a
  return Date.parse(b) < Date.parse(a) ? b : a
}

/** Meta for a put: the new meta, with `created` the earliest known. */
export const merged_meta = (stored = {}, given = {}) => {
  const created = earliest(stored.created, given.created)
  return created ? { ...given, created } : { ...given }
}

/**
 * `gzip: true` always packs the body, so it can be composed onto other gzip
 * files; leaving it undefined packs only when that makes the file smaller.
 * `encoding: 'gzip'` says the body arrives packed: `get` returns it unpacked,
 * and the version is the unpacked bytes' hash.
 * @typedef {{ gzip?: boolean, encoding?: 'gzip' }} Packing
 */

/** Meta: what we know about the data, kept beside its bytes. */
const meta_contract = ({ test, assert, make }) => {
  test('meta rides with the bytes and never moves the version', async () => {
    const store = await make()
    const plain = await store.put('people/+1/p.html', 'poster')
    const sold = await store.put('people/+1/p.html', 'poster', {
      meta: { sold: 'true' }
    })
    assert.equal(sold, plain)
    assert.deepEqual((await store.get('people/+1/p.html')).meta, {
      sold: 'true'
    })
    const listed = await store.walk_meta('people/+1/')
    assert.deepEqual(listed['p.html'].meta, { sold: 'true' })
  })

  test('created keeps the earliest date through every put', async () => {
    const store = await make()
    const key = 'people/+1/c.md'
    await store.put(key, 'one', {
      meta: { created: '2020-01-01T00:00:00.000Z' }
    })
    await store.put(key, 'two', {
      meta: { created: '2024-01-01T00:00:00.000Z' }
    })
    assert.equal(
      (await store.get(key)).meta.created,
      '2020-01-01T00:00:00.000Z'
    )
    await store.put(key, 'three', { meta: { sold: 'true' } })
    assert.deepEqual((await store.get(key)).meta, {
      sold: 'true',
      created: '2020-01-01T00:00:00.000Z'
    })
    await store.put(key, 'four', {
      meta: { created: '2019-06-01T00:00:00.000Z' }
    })
    const listed = await store.walk_meta('people/+1/')
    assert.equal(listed['c.md'].meta.created, '2019-06-01T00:00:00.000Z')
    await store.delete(key)
    await store.put(key, 'again')
    assert.deepEqual((await store.get(key)).meta, {})
  })

  test('a put replaces meta; delete takes it', async () => {
    const store = await make()
    await store.put('people/+1/p.html', 'one', { meta: { sold: 'true' } })
    await store.put('people/+1/p.html', 'two')
    assert.deepEqual((await store.get('people/+1/p.html')).meta, {})
    await store.put('people/+1/p.html', 'three', { meta: { sold: 'true' } })
    await store.delete('people/+1/p.html')
    await store.put('people/+1/p.html', 'four')
    assert.deepEqual((await store.get('people/+1/p.html')).meta, {})
  })
}

/** Guards: writes that only land on the version they expect. */
const guard_contract = ({ test, assert, make }) => {
  test('if_absent creates only when absent', async () => {
    const store = await make()
    await store.put('people/+1/a.md', 'first', { if_absent: true })
    await assert.rejects(
      store.put('people/+1/a.md', 'second', { if_absent: true }),
      { code: 'conflict' }
    )
    assert.equal(text(await store.get('people/+1/a.md')), 'first')
  })

  test('if_version null is refused', async () => {
    const store = await make()
    await assert.rejects(
      store.put('people/+1/a.md', 'x', { if_version: null }),
      TypeError
    )
  })

  test('a matching version writes; a stale one conflicts', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'one')
    await store.put('people/+1/a.md', 'two', { if_version: v1 })
    await assert.rejects(
      store.put('people/+1/a.md', 'three', { if_version: v1 }),
      { code: 'conflict' }
    )
    assert.equal(text(await store.get('people/+1/a.md')), 'two')
  })

  test('a version on a missing key conflicts', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'one')
    await store.delete('people/+1/a.md')
    await assert.rejects(
      store.put('people/+1/a.md', 'again', { if_version: v1 }),
      { code: 'conflict' }
    )
  })

  test('delete removes; a stale delete conflicts', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'one')
    await store.put('people/+1/a.md', 'two')
    await assert.rejects(store.delete('people/+1/a.md', { if_version: v1 }), {
      code: 'conflict'
    })
    await store.delete('people/+1/a.md')
    assert.equal(await store.get('people/+1/a.md'), null)
    await store.delete('people/+1/a.md')
  })
}

/** Listing, walking, racing, and composing. */
const listing_contract = ({ test, assert, make }) => {
  test('list shows direct files and folders only', async () => {
    const store = await make()
    await store.put('people/+1/posters/1.html.gz', 'p')
    await store.put('people/+1/posters/2.html.gz', 'p')
    await store.put('people/+1/posters/deep/3.html.gz', 'p')
    await store.put('people/+1/index.html.gz', 'i')
    assert.deepEqual(await store.list('people/+1/posters/'), {
      files: ['1.html.gz', '2.html.gz'],
      folders: ['deep']
    })
    assert.deepEqual(await store.list('people/+1/'), {
      files: ['index.html.gz'],
      folders: ['posters']
    })
    assert.deepEqual(await store.list('people/'), {
      files: [],
      folders: ['+1']
    })
    assert.deepEqual(await store.list('people/+2/'), {
      files: [],
      folders: []
    })
  })

  test('walk maps every file under a prefix to its version', async () => {
    const store = await make()
    const a = await store.put('people/+1/vault/a.md', 'a')
    const b = await store.put('people/+1/vault/deep/b.md', 'b')
    await store.put('people/+1/other.md', 'o')
    assert.deepEqual(await store.walk('people/+1/vault/'), {
      'a.md': a,
      'deep/b.md': b
    })
    assert.deepEqual(await store.walk('people/+2/'), {})
  })

  test("walk_meta adds each file's size and last update", async () => {
    const store = await make()
    const before = Date.now() - MS_PER_MINUTE
    const a = await store.put('people/+1/vault/a.md', 'abc')
    const listed = await store.walk_meta('people/+1/vault/')
    assert.deepEqual(Object.keys(listed), ['a.md'])
    assert.equal(listed['a.md'].version, a)
    assert.equal(listed['a.md'].size, 3)
    assert.ok(Date.parse(listed['a.md'].updated) >= before)
    assert.deepEqual(await store.walk_meta('people/+2/'), {})
  })

  test('two racing creates: exactly one wins', async () => {
    const store = await make()
    const results = await Promise.allSettled(
      ['one', 'two', 'three'].map(body =>
        store.put('pins/+1', body, { if_absent: true })
      )
    )
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    for (const r of results.filter(r => r.status === 'rejected'))
      assert.equal(r.reason.code, 'conflict')
  })

  test('stat gives the version, or null', async () => {
    const store = await make()
    assert.equal(await store.stat('usage/+1/d/index.html'), null)
    const version = await store.put('usage/+1/d/index.html', '<p>one</p>\n', {
      gzip: true
    })
    assert.equal(await store.stat('usage/+1/d/index.html'), version)
  })

  test('compose joins sources in order, guarded by version', async () => {
    const store = await make()
    await store.put('usage/+1/d/a.html', '<p>one</p>\n', { gzip: true })
    await store.put('usage/+1/d/b.html', '<p>two</p>\n', { gzip: true })
    const v1 = await store.compose(
      'usage/+1/d/index.html',
      ['usage/+1/d/a.html'],
      { if_absent: true }
    )
    await assert.rejects(
      store.compose('usage/+1/d/index.html', ['usage/+1/d/b.html'], {
        if_absent: true
      }),
      { code: 'conflict' }
    )
    const v2 = await store.compose(
      'usage/+1/d/index.html',
      ['usage/+1/d/index.html', 'usage/+1/d/b.html'],
      { if_version: v1 }
    )
    assert.equal(
      text(await store.get('usage/+1/d/index.html')),
      '<p>one</p>\n<p>two</p>\n'
    )
    assert.equal(await store.stat('usage/+1/d/index.html'), v2)
    await assert.rejects(
      store.compose(
        'usage/+1/d/index.html',
        ['usage/+1/d/index.html', 'usage/+1/d/b.html'],
        { if_version: v1 }
      ),
      { code: 'conflict' }
    )
    await assert.rejects(
      store.compose('usage/+1/d/x.html', ['usage/+1/d/none.html']),
      { code: 'conflict' }
    )
  })

  test('bytes survive untouched', async () => {
    const store = await make()
    const bytes = Buffer.from('00ff0a0d1f8b', 'hex')
    await store.put('people/+1/b.bin', bytes)
    assert.deepEqual((await store.get('people/+1/b.bin')).body, bytes)
  })
}

/**
 * The contract every adapter passes. Each adapter's test calls:
 *
 *   contract({ test, assert, make })   make() resolves to a fresh, empty store
 *
 * Keys are relative, `/`-separated. A version is `version_of` the plain
 * bytes, however they are packed: equal bytes share one. A composed key is
 * the exception: its version is opaque, good only for guards.
 */
export const contract = ({ test, assert, make }) => {
  meta_contract({ test, assert, make })
  guard_contract({ test, assert, make })
  listing_contract({ test, assert, make })

  test('find gives every key in a person holding a version', async () => {
    const store = await make()
    const same = await store.put('people/+1/a/x.md', 'same')
    await store.put('people/+1/b/y.md', 'same')
    await store.put('people/+2/z.md', 'same')
    assert.deepEqual(await store.find('people/+1/', same), [
      'people/+1/a/x.md',
      'people/+1/b/y.md'
    ])
    await store.put('people/+1/a/x.md', 'changed')
    await store.delete('people/+2/z.md')
    assert.deepEqual(await store.find('people/+1/', same), ['people/+1/b/y.md'])
    assert.deepEqual(await store.find('people/+2/', same), [])
    await store.delete('people/+1/b/y.md')
    assert.deepEqual(await store.find('people/+1/', same), [])
    assert.deepEqual(await store.list(''), { files: [], folders: ['people'] })
    assert.deepEqual(Object.keys(await store.walk('')), ['people/+1/a/x.md'])
  })

  test('a missing key reads as null', async () => {
    const store = await make()
    assert.equal(await store.get('people/+1/none.md'), null)
  })

  test('put then get returns the bytes and the same version', async () => {
    const store = await make()
    const version = await store.put('people/+1/a.md', 'hello')
    const file = await store.get('people/+1/a.md')
    assert.equal(text(file), 'hello')
    assert.equal(typeof version, 'string')
    assert.equal(file.version, version)
  })

  test('a new write gets a new version', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'one')
    const v2 = await store.put('people/+1/a.md', 'two')
    assert.notEqual(v1, v2)
  })

  test('a version is the plain bytes hash', async () => {
    const store = await make()
    const body = '<p>one</p>\n'.repeat(REPEATS)
    const expected = await version_of(body)
    assert.equal(await store.put('people/+1/a.html', body), expected)
    assert.equal(await store.stat('people/+1/a.html'), expected)
    assert.equal(
      await store.put('people/+1/b.html', body, { gzip: true }),
      expected
    )
    assert.equal((await store.walk('people/+1/'))['b.html'], expected)
  })

  test('a body sent gzip reads back plain under the plain version', async () => {
    const store = await make()
    const body = '<p>sent packed</p>\n'.repeat(REPEATS)
    const version = await store.put('people/+1/a.html', gzip_sync(body), {
      encoding: 'gzip'
    })
    assert.equal(version, await version_of(body))
    const file = await store.get('people/+1/a.html')
    assert.equal(text(file), body)
    assert.equal(file.version, version)
    const listed = await store.walk_meta('people/+1/')
    assert.equal(listed['a.html'].version, version)
    assert.equal(listed['a.html'].size, Buffer.byteLength(body))
    await store.put('people/+1/a.html', 'next', { if_version: version })
  })

  test('equal bytes share a version', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'same')
    const v2 = await store.put('people/+1/b.md', 'same')
    assert.equal(v1, v2)
  })
}
