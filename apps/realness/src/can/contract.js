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
 * leaving it out stores none. Values are strings.
 * @typedef {{ meta?: Record<string, string> }} Described
 */

/**
 * `gzip: true` always packs the body, so it can be composed onto other gzip
 * files; leaving it undefined packs only when that makes the file smaller.
 * @typedef {{ gzip?: boolean }} Packing
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

/**
 * The contract every adapter passes. Each adapter's test calls:
 *
 *   contract({ test, assert, make })   make() resolves to a fresh, empty store
 *
 * Keys are relative, `/`-separated. A version is an opaque hash of the
 * stored bytes: equal bytes share one, and nothing stores it.
 */
export const contract = ({ test, assert, make }) => {
  const text = file => file?.body.toString('utf8')
  meta_contract({ test, assert, make })

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

  test('equal bytes share a version', async () => {
    const store = await make()
    const v1 = await store.put('people/+1/a.md', 'same')
    const v2 = await store.put('people/+1/b.md', 'same')
    assert.equal(v1, v2)
  })

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
    assert.deepEqual(await store.list('people/+2/'), { files: [], folders: [] })
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
