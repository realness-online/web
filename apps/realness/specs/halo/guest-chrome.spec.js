import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { createServer as create_socket_server } from 'node:net'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'

const script = new URL(
  '../../server/halo/guest/realness-chrome.js',
  import.meta.url
).pathname
const lib = new URL('../../', import.meta.url).pathname

mkdirSync(out_path(), { recursive: true })

/** A shell that is a DevTools stub: it answers /json/version and every call. */
const STUB = `const { createHash } = require('node:crypto')
const { createServer } = require('node:http')
const { appendFileSync } = require('node:fs')
const { join } = require('node:path')

const port = Number(
  process.argv.find(one => one.startsWith('--remote-debugging-port=')).split('=')[1]
)
const dir = process.argv[2]
require('node:fs').writeFileSync(join(dir, 'tmpdir'), process.env.TMPDIR ?? '')
const server = createServer((request, reply) => {
  reply.setHeader('content-type', 'application/json')
  reply.end(JSON.stringify({ webSocketDebuggerUrl: \`ws://127.0.0.1:\${port}/\` }))
})
server.on('upgrade', (request, socket) => {
  const accept = createHash('sha1')
    .update(\`\${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11\`)
    .digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\n' +
      \`Sec-WebSocket-Accept: \${accept}\\r\\n\\r\\n\`
  )
  let buffer = Buffer.alloc(0)
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      if (buffer.length < 2) return
      const masked = (buffer[1] & 0x80) !== 0
      let length = buffer[1] & 0x7f
      let offset = 2
      if (length === 126) {
        if (buffer.length < 4) return
        length = buffer.readUInt16BE(2)
        offset = 4
      }
      const key = masked ? buffer.subarray(offset, offset + 4) : null
      if (masked) offset += 4
      if (buffer.length < offset + length) return
      const payload = Buffer.from(buffer.subarray(offset, offset + length))
      if (key) for (let i = 0; i < payload.length; i += 1) payload[i] ^= key[i % 4]
      buffer = buffer.subarray(offset + length)
      const message = JSON.parse(payload.toString('utf8'))
      appendFileSync(
        join(dir, 'methods.jsonl'),
        \`\${JSON.stringify({ method: message.method, params: message.params })}\\n\`
      )
      const body = Buffer.from(
        JSON.stringify({
          id: message.id,
          result:
            message.method === 'Storage.getCookies'
              ? { cookies: [] }
              : {}
        })
      )
      const head =
        body.length < 126
          ? Buffer.from([0x81, body.length])
          : (() => {
              const head = Buffer.alloc(4)
              head[0] = 0x81
              head[1] = 126
              head.writeUInt16BE(body.length, 2)
              return head
            })()
      socket.write(Buffer.concat([head, body]))
    }
  })
})
server.listen(port, '127.0.0.1')
`

const shell_for = dir => {
  writeFileSync(join(dir, 'stub.cjs'), STUB)
  writeFileSync(
    join(dir, 'shell'),
    `#!/bin/sh\nexec ${process.execPath} ${join(dir, 'stub.cjs')} ${dir} "$@"\n`,
    { mode: 0o755 }
  )
}

const methods_of = dir => {
  const text = join(dir, 'methods.jsonl')
  if (!existsSync(text)) return []
  return readFileSync(text, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

/** A door that answers each request from a list and keeps what it was asked. */
const door = async replies => {
  const dir = mkdtempSync(out_path('guest-chrome-'))
  const path = join(dir, 'door.sock')
  const asked = []
  const server = create_socket_server(socket => {
    let text = ''
    socket.on('data', chunk => {
      text += chunk.toString()
      const end = text.indexOf('\n')
      if (end === -1) return
      const request = JSON.parse(text.slice(0, end))
      asked.push(request)
      const reply = replies[request.save ? 'save' : 'cookies'] ?? { ok: true }
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

/** Run the guest script against a door and its own shell and lease folder. */
const chrome = (args, { path }, dir) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: {
        ...process.env,
        REALNESS_DOOR: path,
        REALNESS_LIB: lib,
        REALNESS_CHROME_DIR: dir,
        REALNESS_CHROME_SHELL: join(dir, 'shell')
      }
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

const lease_file = dir => join(dir, `realness-chrome-${process.getuid()}.json`)

/** A test that leaves a Chrome leased leaves a process; stop it with the test. */
const stop_lease = dir => {
  if (!existsSync(lease_file(dir))) return
  try {
    process.kill(
      JSON.parse(readFileSync(lease_file(dir), 'utf8')).pid,
      'SIGKILL'
    )
  } catch {}
}

it('a bare lease starts this box its own Chrome and prints its address', async t => {
  const fake = await door({})
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-lease-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  shell_for(dir)
  const run = await chrome([], fake, dir)
  assert.equal(run.code, 0, run.err)
  assert.match(run.out.trim(), /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.deepEqual(fake.asked, [])
  const lease = JSON.parse(readFileSync(lease_file(dir), 'utf8'))
  assert.equal(lease.url, run.out.trim())
  assert.equal(lease.site, '')
})

it('a site lease takes the jar from the halo and loads it into this Chrome', async t => {
  const cookie = {
    name: 'yc',
    value: 'abc',
    domain: '.workatastartup.com',
    path: '/',
    expires: -1,
    httpOnly: true,
    secure: true
  }
  const fake = await door({ cookies: { ok: true, cookies: [cookie] } })
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-lease-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  shell_for(dir)
  const run = await chrome(['lease', 'yc'], fake, dir)
  assert.equal(run.code, 0, run.err)
  assert.deepEqual(fake.asked, [{ op: 'site-cookies', site: 'yc' }])
  const set = methods_of(dir).find(one => one.method === 'Storage.setCookies')
  assert.deepEqual(set.params.cookies, [cookie])
})

it('a return gives the cookies back and stops the Chrome', async t => {
  const fake = await door({ save: { ok: true, saved: 1 } })
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-lease-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  shell_for(dir)
  await chrome(['lease', 'yc'], fake, dir)
  const run = await chrome(['return'], fake, dir)
  assert.equal(run.code, 0, run.err)
  assert.equal(run.out, 'returned\n')
  assert.equal(fake.asked.at(-1).op, 'site-cookies')
  assert.equal(fake.asked.at(-1).site, 'yc')
  assert.equal(Array.isArray(fake.asked.at(-1).save), true)
  assert.equal(existsSync(lease_file(dir)), false)
})

it('a second lease keeps the Chrome this box already has', async t => {
  const fake = await door({})
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-lease-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  shell_for(dir)
  const first = await chrome([], fake, dir)
  const second = await chrome([], fake, dir)
  assert.equal(second.code, 0, second.err)
  assert.equal(second.out, first.out)
})

it('a return takes no site', async t => {
  const fake = await door({})
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-lease-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  const run = await chrome(['return', 'yc'], fake, dir)
  assert.equal(run.code, 1)
  assert.match(run.err, /usage: realness chrome \[lease \[site\]\|return\]/)
  assert.deepEqual(fake.asked, [])
})

it('a lease gives Chrome a writable temp folder of its own', async t => {
  const fake = await door({})
  t.after(fake.close)
  const dir = mkdtempSync(out_path('chrome-tmp-'))
  t.after(() => {
    stop_lease(dir)
    rmSync(dir, { recursive: true, force: true })
  })
  shell_for(dir)
  const run = await chrome([], fake, dir)
  assert.equal(run.code, 0, run.err)
  const temp = readFileSync(join(dir, 'tmpdir'), 'utf8')
  assert.ok(temp.startsWith(dir), `TMPDIR was '${temp}'`)
  assert.ok(existsSync(temp), 'the temp folder does not exist')
})
