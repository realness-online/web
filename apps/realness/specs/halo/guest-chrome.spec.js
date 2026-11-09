import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'

const script = new URL(
  '../../server/halo/guest/realness-chrome.js',
  import.meta.url
).pathname

mkdirSync(out_path(), { recursive: true })

/** A door that answers one request and keeps what it was asked. */
const door = async (reply = { ok: true, devtools: 'http://1.2.3.4:9222' }) => {
  const dir = mkdtempSync(out_path('guest-chrome-'))
  const path = join(dir, 'door.sock')
  const asked = []
  const server = createServer(socket => {
    let text = ''
    socket.on('data', chunk => {
      text += chunk.toString()
      const end = text.indexOf('\n')
      if (end === -1) return
      asked.push(JSON.parse(text.slice(0, end)))
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

/** Run the guest script against a door and keep what it printed. */
const chrome = (args, { path }) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, REALNESS_DOOR: path }
    })
    let out = ''
    let err = ''
    child.stdout.on('data', chunk => {
      out += chunk
    })
    child.stderr.on('data', chunk => {
      err += chunk
    })
    child.on('error', fail)
    child.on('close', code => done({ code, out, err }))
  })

it('a site on a lease asks for that site, so its jar is loaded', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await chrome(['lease', 'yc'], fake)
  assert.equal(run.code, 0)
  assert.deepEqual(fake.asked, [{ op: 'chrome-lease', site: 'yc' }])
  assert.equal(run.out, 'http://1.2.3.4:9222\n')
})

it('a bare lease asks for no site, so a fresh copy is fine', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await chrome([], fake)
  assert.equal(run.code, 0)
  assert.deepEqual(fake.asked, [{ op: 'chrome-lease' }])
})

it('a return takes no site', async t => {
  const fake = await door()
  t.after(fake.close)
  const run = await chrome(['return', 'yc'], fake)
  assert.equal(run.code, 1)
  assert.match(run.err, /usage: realness chrome \[lease \[site\]\|return\]/)
  assert.deepEqual(fake.asked, [])
})
