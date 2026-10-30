/**
 * The sync service end to end over HTTP: nobody reaches another person's files.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { request } from 'node:http'
import { randomUUID } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { dev_issuer } from '../../src/sync/dev-token.js'
import { rights } from '../../src/sync/rights.js'
import { sync_service } from '../../src/sync/server.js'
import { out_path } from '#root/lib/output.js'
import { gzipSync as gzip_sync } from 'node:zlib'
import { version_of } from '#root/src/files/version.js'

const A = '+15555550100'
const B = '+15555550101'
const dir = out_path(`sync-test-${randomUUID()}`)
const issuer = dev_issuer()
const lines = []
const storage = store_of(disk(dir))
const cache = rights(storage)
let server
let base

before(async () => {
  await mkdir(dir, { recursive: true })
  server = sync_service({
    storage,
    rights: cache,
    project: issuer.project,
    certs: issuer.certs,
    origins: ['https://realness.example'],
    log: l => lines.push(l)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = (phone, options) => ({
  authorization: `Bearer ${issuer.token(phone, options)}`
})
const call = (method, path, { headers = {}, body } = {}) =>
  fetch(`${base}/${path}`, { method, headers, body })
const status = async (...args) => (await call(...args)).status

it('an owner writes, reads, lists, and deletes their own files', async () => {
  assert.equal(
    await status('PUT', `people/${A}/vault/note.md`, {
      headers: as(A),
      body: 'mine'
    }),
    200
  )
  const read = await call('GET', `people/${A}/vault/note.md`, {
    headers: as(A)
  })
  assert.equal(read.status, 200)
  assert.equal(await read.text(), 'mine')
  const listed = await (
    await call('GET', `people/${A}/vault/`, { headers: as(A) })
  ).json()
  assert.deepEqual(listed, { files: ['note.md'], folders: [] })
  assert.equal(
    await status('DELETE', `people/${A}/vault/note.md`, { headers: as(A) }),
    204
  )
  assert.equal(
    await status('GET', `people/${A}/vault/note.md`, { headers: as(A) }),
    404
  )
})

it('a deep list maps every file below to its etag', async () => {
  const put = await call('PUT', `people/${A}/deep/x/y.md`, {
    headers: as(A),
    body: 'y'
  })
  const listed = await (
    await call('GET', `people/${A}/deep/?deep`, { headers: as(A) })
  ).json()
  assert.deepEqual(listed, {
    'x/y.md': put.headers.get('etag').replace(/"/g, '')
  })
  assert.equal(
    await status('GET', `people/${A}/deep/?deep`, { headers: as(B) }),
    403
  )
})

it('names are decoded once; double encoding and bad encoding are refused', async () => {
  const name = encodeURIComponent('Sunday evening — vibe.md')
  assert.equal(
    await status('PUT', `people/${A}/vault/${name}`, {
      headers: as(A),
      body: 'v'
    }),
    200
  )
  const listed = await (
    await call('GET', `people/${A}/vault/`, { headers: as(A) })
  ).json()
  assert.ok(listed.files.includes('Sunday evening — vibe.md'))
  assert.equal(
    await status('GET', `people/${A}/vault/${encodeURIComponent(name)}`, {
      headers: as(A)
    }),
    403
  )
  assert.equal(
    await status('GET', `people/${A}/vault/%E0%A4%A`, { headers: as(A) }),
    400
  )
})

it('percentage filenames upload, list, read, and delete without changing names', async () => {
  const title = '5 Exercises That Fix 95% Of Your Problems - YouTube.md'
  const path = `people/${A}/vault/${encodeURIComponent(title)}`
  assert.equal(await status('PUT', path, { headers: as(A), body: 'note' }), 200)
  assert.equal(
    await (await call('GET', path, { headers: as(A) })).text(),
    'note'
  )
  const listed = await (
    await call('GET', `people/${A}/vault/`, { headers: as(A) })
  ).json()
  assert.ok(listed.files.includes(title))
  assert.equal(await status('GET', path, { headers: as(B) }), 403)
  assert.equal(await status('GET', path), 403)
  for (const encoded of ['%252e%252e', '%252F', '%255c', '%2500'])
    assert.equal(
      await status('PUT', `people/${A}/vault/${encoded}/secret`, {
        headers: as(A),
        body: 'x'
      }),
      403
    )
  assert.equal(await status('DELETE', path, { headers: as(A) }), 204)
})

it('another person never reaches my private files', async () => {
  await call('PUT', `people/${A}/vault/secret.md`, {
    headers: as(A),
    body: 'secret'
  })
  await call('PUT', `people/${A}/relations.html.gz`, {
    headers: as(A),
    body: 'friends'
  })
  for (const path of [
    `people/${A}/vault/secret.md`,
    `people/${A}/relations.html.gz`,
    `people/${A}/vault/`,
    `people/${A}/`
  ]) {
    assert.equal(await status('GET', path, { headers: as(B) }), 403, path)
    assert.equal(await status('GET', path), 403, path)
  }
  assert.equal(
    await status('PUT', `people/${A}/vault/secret.md`, {
      headers: as(B),
      body: 'mine now'
    }),
    403
  )
  assert.equal(
    await status('DELETE', `people/${A}/vault/secret.md`, { headers: as(B) }),
    403
  )
  assert.equal(
    await (
      await call('GET', `people/${A}/vault/secret.md`, { headers: as(A) })
    ).text(),
    'secret'
  )
})

it('denial does not reveal whether a file exists', async () => {
  assert.equal(
    await status('GET', `people/${A}/vault/secret.md`, { headers: as(B) }),
    403
  )
  assert.equal(
    await status('GET', `people/${A}/vault/nothing-here.md`, {
      headers: as(B)
    }),
    403
  )
})

it('public posters read for anyone, write for the owner only', async () => {
  await call('PUT', `people/${A}/posters/1.html.gz`, {
    headers: as(A),
    body: '<svg/>'
  })
  assert.equal(await status('GET', `people/${A}/posters/1.html.gz`), 200)
  assert.equal(await status('GET', `people/${A}/posters/`), 200)
  assert.equal(
    await status('PUT', `people/${A}/posters/1.html.gz`, { body: 'x' }),
    403
  )
  assert.equal(
    await status('PUT', `people/${A}/posters/1.html.gz`, {
      headers: as(B),
      body: 'x'
    }),
    403
  )
})

it('pins and traversal stay out of reach', async () => {
  await call('GET', `people/${A}/vault/`, { headers: as(A) })
  for (const who of [as(A), as(B), {}]) {
    assert.equal(await status('GET', `pins/${A}`, { headers: who }), 403)
    assert.equal(
      await status('PUT', `pins/${A}`, { headers: who, body: 'stolen' }),
      403
    )
  }
  const raw = (path, headers) =>
    new Promise((done, fail) =>
      request(
        { host: '127.0.0.1', port: server.address().port, path, headers },
        r => done(r.resume().statusCode)
      )
        .on('error', fail)
        .end()
    )
  for (const path of [
    `/people/${B}/../${A}/vault/secret.md`,
    `/people/${B}/%2e%2e/${A}/vault/secret.md`,
    `/people/${B}/./x`
  ]) {
    assert.equal(await raw(path, as(B)), 403, path)
  }
  assert.equal(await raw(`/people/${A}/../${A}/vault/secret.md`, as(A)), 403)
})

it('a recycled number and a bad token are refused', async () => {
  await call('GET', `people/${A}/vault/`, { headers: as(A) })
  assert.equal(
    await status('GET', `people/${A}/vault/`, {
      headers: as(A, { uid: 'someone-new' })
    }),
    401
  )
  assert.equal(
    await status('GET', `people/${A}/vault/`, {
      headers: as(A, { lifetime: -10 })
    }),
    401
  )
  assert.equal(
    await status('GET', `people/${A}/vault/`, {
      headers: { authorization: 'Bearer nope' }
    }),
    401
  )
  assert.equal(
    await status('GET', `people/${A}/vault/`, {
      headers: { authorization: 'Basic x' }
    }),
    401
  )
})

it('conditional writes refuse a stale version', async () => {
  const first = await call('PUT', `people/${A}/vault/doc.md`, {
    headers: { ...as(A), 'if-none-match': '*' },
    body: 'v1'
  })
  assert.equal(first.status, 200)
  const v1 = first.headers.get('etag')
  assert.equal(
    await status('PUT', `people/${A}/vault/doc.md`, {
      headers: { ...as(A), 'if-none-match': '*' },
      body: 'again'
    }),
    412
  )
  assert.equal(
    await status('PUT', `people/${A}/vault/doc.md`, {
      headers: { ...as(A), 'if-match': v1 },
      body: 'v2'
    }),
    200
  )
  assert.equal(
    await status('PUT', `people/${A}/vault/doc.md`, {
      headers: { ...as(A), 'if-match': v1 },
      body: 'v3'
    }),
    412
  )
  assert.equal(
    await (
      await call('GET', `people/${A}/vault/doc.md`, { headers: as(A) })
    ).text(),
    'v2'
  )
})

it('only one of two racing first writes wins', async () => {
  const race = await Promise.all(
    ['one', 'two'].map(body =>
      status('PUT', `people/${A}/vault/race.md`, {
        headers: { ...as(A), 'if-none-match': '*' },
        body
      })
    )
  )
  assert.deepEqual(race.sort(), [200, 412])
})

it('logs never hold a raw phone number', () => {
  assert.ok(lines.length > 10)
  for (const line of lines) assert.doesNotMatch(line, /\+\d{7,}/, line)
})

it('unknown methods are refused', async () => {
  assert.equal(
    await status('POST', `people/${A}/vault/x`, { headers: as(A), body: 'x' }),
    405
  )
})

it('a rights change through sync applies at once', async () => {
  const box = `/${A}/harnesses/1`
  const page = href =>
    `<ul><li itemscope itemtype="https://schema.org/DigitalDocumentPermission"><meta itemprop="grantee" content="${box}"><meta itemprop="permissionType" content="https://schema.org/ReadPermission"><a itemprop="about" href="${href}">x</a></li></ul>`
  await call('PUT', `people/${A}/rights.html`, {
    headers: as(A),
    body: page(`/${A}/plans/`)
  })
  const first = await cache.grants(A)
  assert.equal(first.grants[0].path, `/${A}/plans/`)
  await call('PUT', `people/${A}/rights.html`, {
    headers: as(A),
    body: page(`/${A}/vault/`)
  })
  const second = await cache.grants(A)
  assert.equal(second.grants[0].path, `/${A}/vault/`)
  assert.notEqual(second.version, first.version)
  await call('PUT', `people/${A}/rights.html`, {
    headers: as(A),
    body: '<li itemscope'
  })
  assert.deepEqual((await cache.grants(A)).grants, [])
})

it('only allowed sites may call from a browser', async () => {
  const preflight = origin =>
    call('OPTIONS', `people/${A}/vault/`, {
      headers: {
        origin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization'
      }
    })
  const good = await preflight('https://realness.example')
  assert.equal(good.status, 204)
  assert.equal(
    good.headers.get('access-control-allow-origin'),
    'https://realness.example'
  )
  assert.match(
    good.headers.get('access-control-allow-headers'),
    /authorization/
  )
  const bad = await preflight('https://evil.example')
  assert.equal(bad.status, 403)
  assert.equal(bad.headers.get('access-control-allow-origin'), null)

  const read = await call('GET', `people/${A}/posters/`, {
    headers: { origin: 'https://realness.example' }
  })
  assert.equal(
    read.headers.get('access-control-allow-origin'),
    'https://realness.example'
  )
  assert.equal(
    read.headers.get('access-control-expose-headers'),
    'etag, x-meta-sold, x-meta-full-locale, x-meta-created'
  )
  const stranger_site = await call('GET', `people/${A}/posters/`, {
    headers: { origin: 'https://evil.example' }
  })
  assert.equal(stranger_site.headers.get('access-control-allow-origin'), null)
})

it('a global admin reads every loop and may only request a stop', async () => {
  const id = 'a-0123456789ab'
  await storage.put(
    `loops/${id}/record.html`,
    '<article itemscope itemtype="/loop"></article>'
  )
  await storage.put('admins.html', `<a href="tel:${B}">admin</a>`)
  assert.equal(
    await status('GET', `loops/${id}/record.html`, { headers: as(A) }),
    403
  )
  assert.equal(
    await status('GET', `loops/${id}/record.html`, { headers: as(B) }),
    200
  )
  const listed = await (
    await call('GET', 'loops/?deep', { headers: as(B) })
  ).json()
  assert.deepEqual(Object.keys(listed), [`${id}/record.html`])
  assert.equal(
    await status('PUT', `loops/${id}/stop.html`, {
      headers: as(B),
      body: 'stop'
    }),
    200
  )
  assert.equal(
    await status('PUT', `loops/${id}/record.html`, {
      headers: as(B),
      body: 'forged'
    }),
    403
  )
  assert.equal(
    await status('GET', `v1/loops/${id}/record.html`, { headers: as(A) }),
    403
  )
  assert.equal(
    await status('GET', `v1/loops/${id}/stop.html`, { headers: as(B) }),
    200
  )
  assert.equal(
    await status('PUT', `v1/loops/${id}/record.html`, {
      headers: as(B),
      body: 'forged'
    }),
    403
  )
  assert.equal(await status('GET', 'admins.html', { headers: as(B) }), 403)
  assert.equal(
    await status('PUT', 'admins.html', {
      headers: as(A),
      body: `<a href="tel:${A}">me</a>`
    }),
    403
  )
})

it('a global admin reads halo status; a person and a forger cannot', async () => {
  const key = 'halos/realness-1/status.html'
  await storage.put('admins.html', `<a href="tel:${B}">admin</a>`)
  await storage.put(key, '<article itemscope itemtype="/halo"></article>\n')
  assert.equal(await status('GET', key, { headers: as(B) }), 200)
  const halos = await (await call('GET', 'halos/', { headers: as(B) })).json()
  assert.deepEqual(halos.folders, ['realness-1'])
  assert.equal(await status('GET', key, { headers: as(A) }), 403)
  assert.equal(
    await status('PUT', key, { headers: as(B), body: 'forged' }),
    403
  )
})

it("a global admin reads everyone's usage and still no one's files", async () => {
  const row = `usage/${A}/2026-09-30/120000000-a-0123456789ab-abc123.html`
  await storage.put('admins.html', `<a href="tel:${B}">admin</a>`)
  await storage.put(row, '<p itemscope itemtype="/usage"></p>\n')
  await storage.put(`people/${A}/vault/note.md`, 'private')
  assert.equal(await status('GET', row, { headers: as(A) }), 200)
  assert.equal(await status('GET', 'usage/', { headers: as(A) }), 403)
  assert.equal(await status('GET', row, { headers: as(B) }), 200)
  const people = await (await call('GET', 'usage/', { headers: as(B) })).json()
  assert.ok(people.folders.includes(A))
  assert.equal(
    await status('PUT', row, { headers: as(B), body: 'forged' }),
    403
  )
  assert.equal(await status('DELETE', row, { headers: as(B) }), 403)
  assert.equal(
    await status('GET', `people/${A}/vault/note.md`, { headers: as(B) }),
    403
  )
})

it('meta rides x-meta headers in and out; deep=meta lists it', async () => {
  const put = await call('PUT', `people/${A}/posters/1.html`, {
    headers: { ...as(A), 'x-meta-full-locale': 'en-US' },
    body: 'poster'
  })
  assert.equal(put.status, 200)
  const read = await call('GET', `people/${A}/posters/1.html`, {
    headers: as(A)
  })
  assert.equal(read.headers.get('x-meta-full-locale'), 'en-US')
  assert.equal(read.headers.get('etag'), put.headers.get('etag'))
  const listed = await (
    await call('GET', `people/${A}/posters/?deep=meta`, { headers: as(A) })
  ).json()
  assert.deepEqual(listed['1.html'].meta, { fullLocale: 'en-US' })
})

it('an unknown x-meta header is a bad request', async () => {
  assert.equal(
    await status('PUT', `people/${A}/posters/2.html`, {
      headers: { ...as(A), 'x-meta-anything': 'x' },
      body: 'p'
    }),
    400
  )
})

it('a sold poster is never overwritten, but can still be deleted', async () => {
  const key = `people/${A}/posters/3.html`
  await storage.put(key, 'sold one', { meta: { sold: 'true' } })
  assert.equal(
    await status('PUT', key, { headers: as(A), body: 'a re-save' }),
    403
  )
  assert.equal((await storage.get(key)).body.toString(), 'sold one')
  assert.equal(await status('DELETE', key, { headers: as(A) }), 204)
})

it('a browser may send and read meta headers', async () => {
  const preflight = await call('OPTIONS', `people/${A}/posters/1.html`, {
    headers: { origin: 'https://realness.example' }
  })
  assert.match(
    preflight.headers.get('access-control-allow-headers'),
    /x-meta-full-locale/
  )
  const read = await call('GET', `people/${A}/posters/1.html`, {
    headers: { ...as(A), origin: 'https://realness.example' }
  })
  assert.match(read.headers.get('access-control-expose-headers'), /x-meta-sold/)
})

it('HEAD answers a file with its etag and meta, and no body', async () => {
  const key = `people/${A}/posters/4.html`
  const put = await call('PUT', key, {
    headers: { ...as(A), 'x-meta-full-locale': 'fr' },
    body: 'p'
  })
  const head = await call('HEAD', key, { headers: as(A) })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('etag'), put.headers.get('etag'))
  assert.equal(head.headers.get('x-meta-full-locale'), 'fr')
  assert.equal(await head.text(), '')
  assert.equal(
    (await call('HEAD', `people/${A}/posters/none.html`, { headers: as(A) }))
      .status,
    404
  )
})

it('a file is stored as .gz and served as gzip under its plain name', async () => {
  const { gzipSync, gunzipSync } = await import('node:zlib')
  await call('PUT', `people/${A}/posters/5.html`, {
    headers: { ...as(A), 'content-encoding': 'gzip' },
    body: gzipSync('<p>hi</p>')
  })
  const html = await call('GET', `people/${A}/posters/5.html`, {
    headers: as(A)
  })
  assert.equal(html.headers.get('content-encoding'), 'gzip')
  assert.equal(html.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(await html.text(), '<p>hi</p>')
  assert.equal(
    gunzipSync(
      await readFile(join(dir, `people/${A}/posters/5.html.gz`))
    ).toString(),
    '<p>hi</p>'
  )
  const listed = await call('GET', `people/${A}/posters/`, { headers: as(A) })
  assert.ok((await listed.json()).files.includes('5.html'))
  const bytes = gzipSync('x')
  await call('PUT', `people/${A}/vault/a.gz`, { headers: as(A), body: bytes })
  const raw = await call('GET', `people/${A}/vault/a.gz`, { headers: as(A) })
  assert.equal(raw.headers.get('content-type'), 'application/octet-stream')
  assert.deepEqual(Buffer.from(await raw.arrayBuffer()), bytes)
})

it('a gzip write is checked against its plain hash, stored, and read back plain', async () => {
  const plain = '<p>sent packed</p>\n'.repeat(40)
  const version = await version_of(plain)
  const put = await call('PUT', `people/${A}/vault/packed.md`, {
    headers: {
      ...as(A),
      'content-encoding': 'gzip',
      'x-version': `"${version}"`
    },
    body: gzip_sync(plain)
  })
  assert.equal(put.status, 200)
  assert.equal(put.headers.get('etag'), `"${version}"`)
  const read = await call('GET', `people/${A}/vault/packed.md`, {
    headers: as(A)
  })
  assert.equal(await read.text(), plain)
  assert.equal(read.headers.get('etag'), `"${version}"`)
})

it('a plain write with X-Version is checked too', async () => {
  const version = await version_of('plain')
  const put = await call('PUT', `people/${A}/vault/plain.md`, {
    headers: { ...as(A), 'x-version': version },
    body: 'plain'
  })
  assert.equal(put.headers.get('etag'), `"${version}"`)
})

it('a wrong hash, bad gzip, or unknown encoding writes nothing', async () => {
  const path = `people/${A}/vault/refused.md`
  const wrong = await status('PUT', path, {
    headers: {
      ...as(A),
      'content-encoding': 'gzip',
      'x-version': await version_of('other')
    },
    body: gzip_sync('mine')
  })
  assert.equal(wrong, 400)
  const broken = await status('PUT', path, {
    headers: { ...as(A), 'content-encoding': 'gzip' },
    body: Buffer.from('not gzip at all')
  })
  assert.equal(broken, 400)
  const unknown = await status('PUT', path, {
    headers: { ...as(A), 'content-encoding': 'br' },
    body: 'x'
  })
  assert.equal(unknown, 415)
  assert.equal(await status('GET', path, { headers: as(A) }), 404)
})

it('a gzip bomb past the limit is refused', async () => {
  const bomb = gzip_sync(Buffer.alloc(81 * 1024 * 1024))
  const put = await status('PUT', `people/${A}/vault/bomb.bin`, {
    headers: { ...as(A), 'content-encoding': 'gzip' },
    body: bomb
  })
  assert.equal(put, 413)
})

it('x-meta-created keeps the earliest date and refuses anything but ISO time', async () => {
  const path = `people/${A}/vault/dated.md`
  const put = (body, created) =>
    status('PUT', path, {
      headers: { ...as(A), ...(created && { 'x-meta-created': created }) },
      body
    })
  assert.equal(await put('one', '2021-05-01T10:00:00.000Z'), 200)
  assert.equal(await put('two', '2023-05-01T10:00:00.000Z'), 200)
  assert.equal(await put('three'), 200)
  const read = await call('GET', path, { headers: as(A) })
  assert.equal(read.headers.get('x-meta-created'), '2021-05-01T10:00:00.000Z')
  assert.equal(await put('four', 'last tuesday'), 400)
})

it('?version= lists every file in a person holding that version', async () => {
  for (const path of ['twin/a.md', 'twin/deep/b.md'])
    await call('PUT', `people/${A}/${path}`, { headers: as(A), body: 'twin' })
  const version = await version_of('twin')
  const found = await (
    await call('GET', `people/${A}/?version=${version}`, { headers: as(A) })
  ).json()
  assert.deepEqual(found.files, ['twin/a.md', 'twin/deep/b.md'])
  assert.equal(
    await status('GET', `people/${A}/twin/?version=${version}`, {
      headers: as(A)
    }),
    400
  )
  assert.equal(
    await status('GET', `people/${B}/?version=${version}`, { headers: as(A) }),
    403
  )
})

it('m2: a public read with no token may be shared by a CDN; a signed read never', async () => {
  const put = await call('PUT', `people/${A}/posters/1.html`, {
    headers: as(A),
    body: 'p'
  })
  const version = put.headers.get('etag').replace(/"/g, '')
  const cache = async (method, path, headers = {}) =>
    (await call(method, path, { headers })).headers.get('cache-control')
  const poster = `people/${A}/posters/1.html`
  const forever = 'public, max-age=86400, s-maxage=31536000'
  const short = 'public, max-age=0, s-maxage=60'
  assert.equal(await cache('GET', `${poster}?v=${version}`), forever)
  assert.equal(await cache('GET', `${poster}?v=old`), short)
  assert.equal(await cache('GET', poster), short)
  assert.equal(await cache('HEAD', `${poster}?v=${version}`), short)
  assert.equal(await cache('GET', `people/${A}/posters/`), short)
  assert.equal(await cache('GET', `${poster}?v=${version}`, as(A)), null)
  assert.equal(await cache('GET', `${poster}?v=${version}`, as(B)), null)
  assert.equal(
    await cache('GET', `people/${A}/posters/missing.html`),
    'no-store'
  )
  assert.equal(await status('GET', `people/${A}/relations.html`), 403)
  assert.equal(await cache('GET', `people/${A}/relations.html`), 'no-store')
})

it("m2: a poster's layers keep a year even unversioned; its index stays short", async () => {
  const cache = async path =>
    (await call('GET', path)).headers.get('cache-control')
  const forever = 'public, max-age=86400, s-maxage=31536000'
  for (const layer of [
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders',
    'shadows'
  ]) {
    const path = `people/${A}/posters/3-${layer}.html`
    await call('PUT', path, { headers: as(A), body: layer })
    assert.equal(await cache(path), forever, layer)
  }
  await call('PUT', `people/${A}/posters/3.html`, {
    headers: as(A),
    body: 'index'
  })
  assert.equal(
    await cache(`people/${A}/posters/3.html`),
    'public, max-age=0, s-maxage=60'
  )
  await call('PUT', `people/${A}/posters/3-notes.html`, {
    headers: as(A),
    body: 'x'
  })
  assert.equal(
    await cache(`people/${A}/posters/3-notes.html`),
    'public, max-age=0, s-maxage=60'
  )
})

it('m2: a rewrite at the same path gets a new versioned URL', async () => {
  const path = `people/${A}/posters/2.html`
  const first = await call('PUT', path, { headers: as(A), body: 'before sale' })
  const second = await call('PUT', path, { headers: as(A), body: 'after sale' })
  const [v1, v2] = [first, second].map(r =>
    r.headers.get('etag').replace(/"/g, '')
  )
  assert.notEqual(v1, v2)
  const read = await call('GET', `${path}?v=${v1}`)
  assert.equal(await read.text(), 'after sale')
  assert.equal(
    read.headers.get('cache-control'),
    'public, max-age=0, s-maxage=60'
  )
})
