import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { out_path } from '#root/lib/output.js'

const script = new URL(
  '../../server/halo/guest/realness-read.js',
  import.meta.url
).pathname

mkdirSync(out_path(), { recursive: true })

/** A door that answers one request and keeps what it was asked. */
const door = async reply_of => {
  const dir = mkdtempSync(out_path('guest-read-'))
  const path = join(dir, 'door.sock')
  const asked = []
  const server = createServer(socket => {
    let text = ''
    socket.on('data', chunk => {
      text += chunk.toString()
      const end = text.indexOf('\n')
      if (end === -1) return
      const request = JSON.parse(text.slice(0, end))
      asked.push(request)
      const reply = reply_of
        ? reply_of(request)
        : { ok: true, kind: 'html', body: 'x' }
      socket.end(`${JSON.stringify(reply)}\n`)
    })
  })
  await new Promise(done => server.listen(path, done))
  return {
    path,
    asked,
    close: () =>
      new Promise(done => server.close(done)).then(() =>
        rmSync(dir, { recursive: true, force: true })
      )
  }
}

const lib = new URL('../../', import.meta.url).pathname
const empty = mkdtempSync(out_path('guest-read-empty-'))
after(() => rmSync(empty, { recursive: true, force: true }))

const read = (args, { path }, env = {}) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: {
        ...process.env,
        REALNESS_DOOR: path,
        REALNESS_LIB: lib,
        REALNESS_VAULT: empty,
        REALNESS_JARS: empty,
        ...env
      }
    })
    let out = ''
    let err = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', chunk => (err += chunk))
    child.on('error', fail)
    child.on('close', code => done({ code, out, err }))
  })

it('a site read asks the door for its login, and page flags do not break it', async t => {
  const fake = await door(() => ({ ok: true, cookies: [] }))
  t.after(fake.close)
  const run = await read(
    ['--site', 'yc', 'https://www.workatastartup.com/', '--max', '4000'],
    fake
  )
  assert.equal(run.code, 1)
  assert.match(run.err, /no saved yc login/)
  assert.deepEqual(fake.asked, [{ op: 'site-cookies', site: 'yc' }])
})

const harness_pi = new URL('../../../../.pi', import.meta.url).pathname
const JOBS =
  '<html><head><title>Jobs</title></head><body><main><h1>Jobs</h1>' +
  `<p>One job. Another job. ${'More words about the work. '.repeat(40)}</p>` +
  '</main></body></html>'

/**
 * An actor's home whose page cache already holds one page, read once by the
 * engine from a local server; the actor then reads that page from its cache.
 */
const cached_page = async t => {
  const home = mkdtempSync(out_path('guest-read-home-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  symlinkSync(harness_pi, join(home, '.pi'))
  const server = createHttpServer((request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html',
      'cache-control': 'max-age=86400'
    })
    response.end(JOBS)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => new Promise(done => server.close(done)))
  const url = `http://127.0.0.1:${server.address().port}/jobs`
  const { WebEngine } = await import('../../src/halo/web-engine.js')
  await new WebEngine({
    root: join(home, 'artifacts', 'realness-read'),
    allow_private: true
  }).read(url)
  return { home, url }
}

it('a brief read prints the body alone, read in the actor', async t => {
  const fake = await door()
  t.after(fake.close)
  const { home, url } = await cached_page(t)
  const run = await read([url, '--brief'], fake, { REALNESS_HOME: home })
  assert.equal(run.code, 0, run.err)
  assert.match(run.out, /<h1>Jobs<\/h1>/)
  assert.deepEqual(fake.asked, [])
})

it('a plain read prints the page as markdown, read in the actor', async t => {
  const fake = await door()
  t.after(fake.close)
  const { home, url } = await cached_page(t)
  const run = await read([url, '--grep', 'another'], fake, {
    REALNESS_HOME: home
  })
  assert.equal(run.code, 0, run.err)
  assert.match(
    run.out,
    /^# Jobs\n<!-- http:\/\/127\.0\.0\.1:\d+\/jobs \| cache static \| \d+ chars -->/
  )
  assert.match(run.out, /One job\. Another job\./)
  assert.deepEqual(fake.asked, [])
})

it('a json read prints the whole reply; a failed read exits 3', async t => {
  const fake = await door()
  t.after(fake.close)
  const { home, url } = await cached_page(t)
  const run = await read([url, '--json'], fake, { REALNESS_HOME: home })
  const reply = JSON.parse(run.out)
  assert.equal(reply.ok, true)
  assert.equal(reply.source, 'cache')
  assert.equal(reply.via, 'static')
  assert.equal(reply.kind, 'html')
  assert.match(reply.body, /<h1>Jobs<\/h1>/)
  const failed = await read(['https://example.invalid/', '--fresh'], fake, {
    REALNESS_HOME: home,
    REALNESS_CHROME_BIN: '/bin/false'
  })
  assert.equal(failed.code, 3)
  assert.match(failed.err, /realness-read: /)
  assert.deepEqual(fake.asked, [])
})

it('a site flag with no slug is a usage error', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await read(['--site'], fake)
  assert.equal(run.code, 1)
  assert.match(run.err, /usage: realness-read/)
  assert.deepEqual(fake.asked, [])
})

it('scout code that throws falls back to the login read', async t => {
  const cookie = {
    name: 'yc',
    value: 'abc',
    domain: '.workatastartup.com',
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: true
  }
  const fake = await door(() => ({ ok: true, cookies: [cookie] }))
  t.after(fake.close)
  const vault = mkdtempSync(out_path('guest-read-vault-'))
  t.after(() => rmSync(vault, { recursive: true, force: true }))
  mkdirSync(join(vault, 'Projects', 'plan'), { recursive: true })
  writeFileSync(
    join(vault, 'Projects', 'plan', 'Sources.md'),
    '```js scout yc 127.0.0.1\nexport const read = async () => {\n  throw new Error("site changed")\n}\n```\n'
  )
  const run = await read(['--site', 'yc', 'http://127.0.0.1:1/'], fake, {
    REALNESS_VAULT: vault
  })
  assert.equal(run.code, 1)
  assert.match(run.err, /yc scout code failed, reading through the halo/)
  assert.deepEqual(
    fake.asked.map(request => request.op),
    ['site-cookies', 'site-cookies']
  )
})

it('an actor loads a plain page itself, in its own Chrome, and never asks the halo', async t => {
  const fake = await door()
  t.after(fake.close)
  const home = mkdtempSync(out_path('guest-read-home-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  const asked = join(home, 'chrome-asked')
  const chrome = join(home, 'realness-chrome')
  writeFileSync(chrome, `#!/bin/sh\necho "$@" >> ${asked}\nexit 1\n`, {
    mode: 0o755
  })
  symlinkSync(harness_pi, join(home, '.pi'))
  const run = await read(['https://example.invalid/', '--fresh'], fake, {
    REALNESS_HOME: home,
    REALNESS_CHROME_BIN: chrome
  })
  assert.equal(run.code, 3, run.err)
  assert.deepEqual(
    fake.asked.filter(request => request.op === 'read'),
    []
  )
  assert.ok(existsSync(asked), 'the actor never asked its own Chrome')
})

it('a scout run refuses a page off its source list, and never loads it', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await read(['https://other.test/jobs', '--brief'], fake, {
    REALNESS_READ_ALLOWED: JSON.stringify(['https://board.test/jobs'])
  })
  assert.equal(run.code, 4)
  assert.match(
    run.err,
    /https:\/\/other\.test\/jobs is not on this source's list/
  )
  assert.match(run.err, /https:\/\/board\.test\/jobs/)
  assert.deepEqual(fake.asked, [])
})

it('a scout run reads a page on its source list', async t => {
  const fake = await door()
  t.after(fake.close)
  const { home, url } = await cached_page(t)
  const run = await read([url, '--brief'], fake, {
    REALNESS_HOME: home,
    REALNESS_READ_ALLOWED: JSON.stringify([url.replace(/\/jobs$/, '/')])
  })
  assert.equal(run.code, 0, run.err)
  assert.match(run.out, /<h1>Jobs<\/h1>/)
})
