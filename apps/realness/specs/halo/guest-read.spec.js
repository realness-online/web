import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

it('a brief read asks for the body alone and prints it', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await read(['https://vuejobs.com/jobs', '--brief'], fake)
  assert.equal(run.code, 0)
  assert.equal(run.out, 'x\n')
  assert.deepEqual(fake.asked, [
    {
      op: 'read',
      url: 'https://vuejobs.com/jobs',
      fresh: false,
      brief: true
    }
  ])
})

it('a plain read asks for no site and prints the page as markdown', async t => {
  const fake = await door(() => ({
    ok: true,
    source: 'commoncrawl',
    kind: 'html',
    title: 'Jobs',
    crawled: '20261001000000',
    body: '<html><body><main><h1>Jobs</h1><p>One job. Another job.</p></main></body></html>'
  }))
  t.after(fake.close)
  const run = await read(
    ['https://vuejobs.com/jobs', '--fresh', '--grep', 'another'],
    fake
  )
  assert.equal(run.code, 0, run.err)
  assert.match(
    run.out,
    /^# Jobs\n<!-- https:\/\/vuejobs\.com\/jobs \| commoncrawl 20261001 \| \d+ chars -->/
  )
  assert.match(run.out, /One job\. Another job\./)
  assert.deepEqual(fake.asked, [
    { op: 'read', url: 'https://vuejobs.com/jobs', fresh: true }
  ])
})

it('a json read prints the whole reply; a failed read exits 3', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await read(['https://vuejobs.com/jobs', '--json'], fake)
  assert.deepEqual(JSON.parse(run.out), { ok: true, kind: 'html', body: 'x' })
  const broken = await door(() => ({ ok: false, error: 'static: thin' }))
  t.after(broken.close)
  const failed = await read(['https://vuejobs.com/jobs'], broken)
  assert.equal(failed.code, 3)
  assert.match(failed.err, /realness-read: static: thin/)
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
