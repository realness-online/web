import { MS_PER_MINUTE } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- writes are ordered so the change feed sees them in order */
/**
 * Options every adapter accepts on a write.
 *
 * `if_version` is the version the caller last read: a string matches it, and
 * `null` means create only when the key is absent. Leaving it undefined
 * writes without a precondition.
 * @typedef {{ if_version?: string | null }} VersionGuard
 */

/**
 * `gzip: true` always packs the body, so it can be composed onto other gzip
 * files; leaving it undefined packs only when that makes the file smaller.
 * @typedef {{ gzip?: boolean }} Packing
 */

/**
 * The contract every adapter passes. Each adapter's test calls:
 *
 *   contract({ test, assert, make })   make() resolves to a fresh, empty store
 *
 * Keys are relative, `/`-separated; versions are opaque strings.
 */
export const contract = ({ test, assert, make }) => {
  const text = file => file?.body.toString('utf8')

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

  test('if_version null creates only when absent', async () => {
    const store = await make()
    await store.put('people/+1/a.md', 'first', { if_version: null })
    await assert.rejects(
      store.put('people/+1/a.md', 'second', { if_version: null }),
      { code: 'conflict' }
    )
    assert.equal(text(await store.get('people/+1/a.md')), 'first')
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
        store.put('pins/+1', body, { if_version: null })
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
      { if_version: null }
    )
    await assert.rejects(
      store.compose('usage/+1/d/index.html', ['usage/+1/d/b.html'], {
        if_version: null
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

  test('list_after gives the names after a cursor, in order', async () => {
    const store = await make()
    for (const name of ['b', 'a', 'c'])
      await store.put(`changes/+1/${name}`, '')
    await store.put('changes/+1/deep/d', '')
    assert.deepEqual(await store.list_after('changes/+1/', ''), ['a', 'b', 'c'])
    assert.deepEqual(await store.list_after('changes/+1/', 'a'), ['b', 'c'])
    assert.deepEqual(await store.list_after('changes/+1/', 'c'), [])
  })

  test('bytes survive untouched', async () => {
    const store = await make()
    const bytes = Buffer.from('00ff0a0d1f8b', 'hex')
    await store.put('people/+1/b.bin', bytes)
    assert.deepEqual((await store.get('people/+1/b.bin')).body, bytes)
  })
}
