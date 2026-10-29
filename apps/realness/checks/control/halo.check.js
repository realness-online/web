#!/usr/bin/env node

import { execFileSync as exec_file_sync } from 'node:child_process'
import { secret_path } from '#root/src/settings/secrets.js'
import { createHmac as create_hmac } from 'node:crypto'
import { connect } from 'node:net'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const PTY = process.env.PTY ?? '127.0.0.1:18081'
const KILL = process.env.KILL ?? 'limactl shell fc-local sudo kill -9 {pid}'
// A Firecracker actor on the Mac is a VM inside Lima: Pi takes ~40 s to draw
// there. DRAW_MS=90000 for that run; GCP and boxes draw well inside 30 s.
const DRAW_MS = Number(process.env.DRAW_MS ?? 30000)

const made = new Set()
const owner = '+14156667777'
const secretPath = secret_path('halo-pass-secret')
const secret =
  process.env.HALO_PASS_SECRET ??
  (exists_sync(secretPath) ? read_file_sync(secretPath, 'utf8').trim() : null)

const haloPass = (phone = owner) => {
  assert.ok(
    secret && Buffer.byteLength(secret) >= 32,
    'HALO_PASS_SECRET required for check:halo'
  )
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
      phone,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
}

const call = async (method, path, body, phone = owner) => {
  const init = {
    method,
    headers: { authorization: `Bearer ${haloPass(phone)}` }
  }
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  const response = await fetch(`${API}${path}`, init)
  const text = await response.text()
  const type = response.headers.get('content-type') ?? ''
  const json = type.includes('json') && text ? JSON.parse(text) : undefined
  return { status: response.status, type, text, json }
}

const create = async body => {
  const result = await call('POST', '/v1/actors', body)
  assert.equal(result.status, 201, result.text)
  made.add(result.json.id)
  return result.json
}

const destroy = async id => {
  const result = await call('DELETE', `/v1/actors/${id}`)
  made.delete(id)
  return result
}

const sh = async (id, command, timeout = 60) => {
  const result = await call('POST', `/v1/actors/${id}/exec`, {
    argv: ['/bin/sh', '-c', command],
    timeout
  })
  assert.equal(result.status, 200, result.text)
  return {
    code: result.json.exit_code,
    out: Buffer.from(result.json.stdout_b64, 'base64').toString(),
    err: Buffer.from(result.json.stderr_b64, 'base64').toString()
  }
}

const ACTOR_FIELDS = [
  'id',
  'state',
  'created',
  'tap',
  'pid',
  'hostname',
  'machine_id',
  'boot_id',
  'dir',
  'owner',
  'paths',
  'last_activity',
  'synced_at'
]

after(async () => {
  for (const id of made) await destroy(id).catch(() => {})
})

describe('health', () => {
  test('reports the seed and actor counts', async () => {
    const { status, json } = await call('GET', '/v1/health')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.seed.built, true)
    assert.equal(json.seed.matches, true)
    assert.deepEqual(json.seed.mismatches, [])
    for (const key of ['machine_id', 'boot_id', 'created'])
      assert.ok(key in json.seed, key)
    assert.equal(typeof json.actors, 'object')
  })
})

describe('routes and errors', () => {
  test('unknown routes are JSON 404s', async () => {
    for (const [method, path] of [
      ['GET', '/nope'],
      ['POST', '/nope'],
      ['DELETE', '/nope']
    ]) {
      const { status, json } = await call(method, path)
      assert.equal(status, 404, `${method} ${path}`)
      assert.match(json.error, /no route/)
    }
  })

  test('an unknown actor is a 404 on every verb', async () => {
    const id = 'a-doesnotexist'
    for (const [method, path] of [
      ['GET', `/v1/actors/${id}`],
      ['POST', `/v1/actors/${id}/exec`],
      ['POST', `/v1/actors/${id}/idle`],
      ['POST', `/v1/actors/${id}/reload`],
      ['POST', `/v1/actors/${id}/export`],
      ['DELETE', `/v1/actors/${id}`]
    ]) {
      const body = path.endsWith('/exec') ? { argv: ['/bin/true'] } : undefined
      const { status, json } = await call(method, path, body)
      assert.equal(status, 404, `${method} ${path}`)
      assert.equal(json.error, 'no such actor')
    }
  })

  test('an actor id cannot climb out of the volume', async () => {
    const { status } = await call('GET', '/v1/actors/..')
    assert.notEqual(status, 200)
  })

  test('a body that is not a JSON object is a 400', async () => {
    for (const body of ['{not json', '[1,2]']) {
      const { status, json } = await call('POST', '/v1/actors', body)
      assert.equal(status, 400, body)
      assert.ok(json.error)
    }
  })

  test('restore_from must be a non-empty string', async () => {
    const { status } = await call('POST', '/v1/actors', { restore_from: 7 })
    assert.equal(status, 400)
  })

  test('restoring an unknown export is a 404', async () => {
    const { status } = await call('POST', '/v1/actors', {
      restore_from: 'a-noexport'
    })
    assert.equal(status, 404)
  })

  test('nothing published is a plain 404', async () => {
    const { status, type } = await call('GET', '/s/a-doesnotexist/')
    assert.equal(status, 404)
    assert.match(type, /text\/plain/)
  })
})

describe("an actor's life", () => {
  let actor

  before(async () => {
    actor = await create()
  })

  test('create answers the record, running', () => {
    assert.deepEqual(Object.keys(actor).sort(), [...ACTOR_FIELDS].sort())
    assert.match(actor.id, /^a-/)
    assert.equal(actor.state, 'running')
    assert.ok(actor.machine_id)
  })

  test('private routes reject missing and foreign passes', async () => {
    const path = `/v1/actors/${actor.id}`
    const missing = await fetch(`${API}${path}`)
    assert.equal(missing.status, 401)
    assert.equal(
      (await call('GET', path, undefined, '+14155559999')).status,
      404
    )
    assert.deepEqual(
      (await call('GET', '/v1/actors', undefined, '+14155559999')).json.actors,
      []
    )
    assert.equal(
      (await call('POST', `${path}/exec`, { argv: ['true'] }, '+14155559999'))
        .status,
      404
    )
    assert.equal(
      (await call('DELETE', path, undefined, '+14155559999')).status,
      404
    )
    assert.equal((await call('GET', path)).status, 200)
  })

  test('get and list agree with create', async () => {
    const one = await call('GET', `/v1/actors/${actor.id}`)
    assert.equal(one.status, 200)
    assert.equal(one.json.id, actor.id)
    const all = await call('GET', '/v1/actors')
    assert.ok(all.json.actors.some(s => s.id === actor.id))
  })

  test('exec runs argv, passes stdin, and keeps exit codes', async () => {
    const echo = await sh(actor.id, 'echo hello; echo oops >&2; exit 3')
    assert.equal(echo.code, 3)
    assert.equal(echo.out, 'hello\n')
    assert.equal(echo.err, 'oops\n')

    const cat = await call('POST', `/v1/actors/${actor.id}/exec`, {
      argv: ['/bin/cat'],
      stdin_b64: Buffer.from([0, 1, 2, 255]).toString('base64')
    })
    assert.equal(cat.status, 200)
    assert.deepEqual(
      [...Buffer.from(cat.json.stdout_b64, 'base64')],
      [0, 1, 2, 255]
    )

    const cwd = await call('POST', `/v1/actors/${actor.id}/exec`, {
      argv: ['/bin/pwd'],
      cwd: '/tmp'
    })
    assert.equal(
      Buffer.from(cwd.json.stdout_b64, 'base64').toString().trim(),
      '/tmp'
    )
  })

  test('exec rejects bad input with a 400', async () => {
    for (const body of [
      { argv: ['/bin/true'], stdin_b64: '!!!' },
      { argv: ['/bin/true'], stdin_b64: 5 },
      { argv: ['/bin/true'], timeout: 0 },
      { argv: ['/bin/true'], timeout: '10' },
      { argv: ['/bin/true'], timeout: 1e9 }
    ]) {
      const { status } = await call('POST', `/v1/actors/${actor.id}/exec`, body)
      assert.equal(status, 400, JSON.stringify(body))
    }
  })

  test('two execs in one actor run at once', async () => {
    const started = Date.now()
    const long = sh(actor.id, 'sleep 5').then(() => Date.now() - started)
    const short = sh(actor.id, 'sleep 1').then(() => Date.now() - started)
    const [longMs, shortMs] = await Promise.all([long, short])
    assert.ok(
      shortMs + 1500 < longMs,
      `execs did not overlap: short ${shortMs}ms, long ${longMs}ms`
    )
  })

  test('idle to memory, then exec wakes it with files kept', async () => {
    await sh(actor.id, 'echo kept > /realness/h4a-memory')
    const idle = await call('POST', `/v1/actors/${actor.id}/idle`, {})
    assert.equal(idle.status, 200)
    assert.equal(idle.json.state, 'idle')
    const again = await call('POST', `/v1/actors/${actor.id}/idle`, {})
    assert.equal(again.status, 200, 'idle is idempotent')
    const read = await sh(actor.id, 'cat /realness/h4a-memory')
    assert.equal(read.out, 'kept\n')
  })

  test('idle to disk stops it; reload boots the same disk', async () => {
    await sh(actor.id, 'echo kept > /realness/h4a-disk')
    const idle = await call('POST', `/v1/actors/${actor.id}/idle`, {
      tier: 'disk'
    })
    assert.equal(idle.json.state, 'stopped')
    const reload = await call('POST', `/v1/actors/${actor.id}/reload`)
    assert.equal(reload.status, 200)
    assert.equal(reload.json.state, 'running')
    assert.equal(reload.json.machine_id, actor.machine_id, 'identity persists')
    assert.equal((await sh(actor.id, 'cat /realness/h4a-disk')).out, 'kept\n')
  })

  test('an unknown idle tier is a 400', async () => {
    const { status } = await call('POST', `/v1/actors/${actor.id}/idle`, {
      tier: 'freezer'
    })
    assert.equal(status, 400)
  })

  test('publish serves the tree at its returned URL', async () => {
    await sh(
      actor.id,
      "mkdir -p /realness/site/blog && echo '<h1>hi</h1>' > /realness/site/index.html && echo post > /realness/site/blog/hello.html"
    )
    const published = await call('POST', `/v1/actors/${actor.id}/publish`, {})
    assert.equal(published.status, 200, published.text)
    assert.equal(published.json.files, 2)

    if (published.json.url.startsWith('/sites/')) {
      const origin =
        process.env.SYNC_SITE_PUBLIC_URL ?? 'http://127.0.0.1:18096'
      const site = `${origin}${published.json.url}`
      const index = await fetch(site)
      assert.equal(index.status, 200)
      assert.match(index.headers.get('content-type'), /text\/html/)
      assert.equal(await index.text(), '<h1>hi</h1>\n')
      assert.equal(
        await (await fetch(`${site}blog/hello`)).text(),
        'post\n',
        'pretty links'
      )
      assert.equal((await fetch(`${site}missing.css`)).status, 404)
    } else {
      assert.equal(published.json.url, `/s/${actor.id}/`)
      const index = await call('GET', `/s/${actor.id}/`)
      assert.equal(index.status, 200)
      assert.match(index.type, /text\/html/)
      assert.equal(index.text, '<h1>hi</h1>\n')
      assert.equal(
        (await call('GET', `/s/${actor.id}/blog/hello`)).text,
        'post\n',
        'pretty links'
      )
      assert.equal(
        (await call('GET', `/s/${actor.id}/missing.css`)).status,
        404
      )
    }
  })

  test('publish refuses relative and climbing paths', async () => {
    for (const path of ['site', '/realness/../etc', 5]) {
      const { status } = await call('POST', `/v1/actors/${actor.id}/publish`, {
        path
      })
      assert.equal(status, 400, String(path))
    }
    const missing = await call('POST', `/v1/actors/${actor.id}/publish`, {
      path: '/nope'
    })
    assert.equal(missing.status, 400)
  })

  test('a published path cannot leave the site', async () => {
    const out = exec_file_sync('curl', [
      '-s',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '--path-as-is',
      `${API}/s/${actor.id}/../../etc/passwd`
    ]).toString()
    assert.notEqual(out, '200')
  })

  test("the halo keeps the page's pane layout", async () => {
    const path = `/v1/actors/${actor.id}/layout`
    assert.deepEqual((await call('GET', path)).json, { layout: null })
    const layout = {
      split: 'row',
      panes: [{ session: null }, { session: 'logs' }]
    }
    assert.equal((await call('POST', path, { layout })).status, 200)
    assert.deepEqual((await call('GET', path)).json, { layout })
    assert.equal((await call('POST', path, { layout: 'row' })).status, 400)
    assert.equal(
      (await call('GET', path, undefined, '+14155559999')).status,
      404
    )
  })

  test('the trace records what happened, oldest first', async () => {
    const { json } = await call('GET', `/v1/actors/${actor.id}/trace`)
    const events = json.events.map(e => e.event)
    for (const event of ['idle', 'reload', 'publish'])
      assert.ok(events.includes(event), event)
    const times = json.events.map(e => e.ts)
    assert.deepEqual(times, [...times].sort())
  })

  test('export leaves it stopped; restore makes a new identity with the files', async () => {
    const manifest = await call('POST', `/v1/actors/${actor.id}/export`)
    assert.equal(manifest.status, 200, manifest.text)
    assert.equal(manifest.json.schema, 1)
    assert.equal(manifest.json.id, actor.id)
    assert.deepEqual(manifest.json.artifacts.paths, ['realness'])
    assert.match(manifest.json.artifacts.sha256, /^[0-9a-f]{64}$/)
    assert.equal(
      (await call('GET', `/v1/actors/${actor.id}`)).json.state,
      'stopped'
    )

    const exports = await call('GET', '/v1/exports')
    assert.ok(exports.json.exports.some(e => e.id === actor.id))

    const foreign = await call(
      'POST',
      '/v1/actors',
      { restore_from: actor.id },
      '+14155559999'
    )
    assert.equal(foreign.status, 404, foreign.text)

    const copy = await create({ restore_from: actor.id })
    assert.notEqual(copy.id, actor.id)
    assert.notEqual(copy.machine_id, actor.machine_id)
    assert.equal((await sh(copy.id, 'cat /realness/h4a-disk')).out, 'kept\n')
    const restored = await sh(
      copy.id,
      'test -d /realness/.pi && test -f /realness/AGENTS.md && test ! -e /root/realness && printf \'%s\' "$HOME"'
    )
    assert.equal(restored.code, 0, restored.err)
    assert.equal(restored.out, '/realness')
    const trace = await call('GET', `/v1/actors/${copy.id}/trace`)
    const events = trace.json.events.map(e => e.event)
    assert.ok(events.includes('publish'), "the source's trace came along")
    assert.ok(events.includes('restore'))
  })

  test('destroy is a 204 and the actor and site are gone', async () => {
    const gone = await destroy(actor.id)
    assert.equal(gone.status, 204)
    assert.equal(gone.text, '')
    assert.equal((await call('GET', `/v1/actors/${actor.id}`)).status, 404)
    assert.equal((await call('GET', `/s/${actor.id}/`)).status, 404)
  })
})

describe('terminal', () => {
  test('a hello without a pass is refused', async () => {
    const [host, port] = PTY.split(':')
    const socket = connect(Number(port), host)
    const answer = await new Promise((done, fail) => {
      socket.once('error', fail)
      socket.once('connect', () => socket.write('{"actor":"a-none"}\n'))
      socket.once('data', data => {
        socket.destroy()
        done(JSON.parse(data.toString()))
      })
    })
    assert.ok(answer.error)
  })

  test("a new actor's terminal opens in Pi, as the page attaches", async () => {
    const actor = await create()
    const opener = Buffer.from('realness\r').toString('base64')
    const text = await terminal(actor.id, /inkling/, {
      ms: 120000,
      send: [
        { op: 'resize', cols: 80, rows: 24 },
        { op: 'data', data_b64: opener }
      ]
    })
    assert.match(text, /inkling/)
    await destroy(actor.id)
  })

  test('a terminal opens and draws', async () => {
    const actor = await create()
    const text = await terminal(actor.id, /\S/)
    assert.match(text, /\S/)
    await destroy(actor.id)
  })
})

const terminal = async (
  id,
  until,
  { keep = false, ms = DRAW_MS, send = [] } = {}
) => {
  const [host, port] = PTY.split(':')
  const socket = connect(Number(port), host)
  let buffer = ''
  let text = ''
  let ready = false
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`no ${until} in: ${text.slice(-300)}`))
    }, ms)
    socket.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    socket.once('connect', () =>
      socket.write(
        `${JSON.stringify({ actor: id, cols: 80, rows: 24, pass: haloPass() })}\n`
      )
    )
    socket.on('data', chunk => {
      buffer += chunk.toString()
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        if (!ready) {
          if (!line.includes('"ok"')) {
            clearTimeout(timer)
            socket.destroy()
            return reject(new Error(line))
          }
          ready = true
          for (const message of send)
            socket.write(`${JSON.stringify(message)}\n`)
          continue
        }
        for (const match of line.matchAll(/"data_b64":\s*"([^"]*)"/g))
          text += Buffer.from(match[1], 'base64').toString()
        if (until.test(text)) {
          clearTimeout(timer)
          if (!keep) socket.destroy()
          return resolve(
            keep ? { text, ws: { close: () => socket.destroy() } } : text
          )
        }
      }
    })
  })
}

describe('h3 lessons', () => {
  test('destroy with a terminal attached finishes', async () => {
    const actor = await create()
    const { ws } = await terminal(actor.id, /\S/, { keep: true })
    const started = Date.now()
    const gone = await destroy(actor.id)
    ws.close()
    assert.equal(gone.status, 204, gone.text)
    assert.ok(
      Date.now() - started < 15000,
      `destroy took ${Date.now() - started}ms`
    )
    const list = await call('GET', '/v1/actors')
    assert.ok(!list.json.actors.some(s => s.id === actor.id), 'no orphan')
  })

  test('a hard stop keeps every file written before it', async () => {
    const actor = await create()
    const count = 3000
    await sh(
      actor.id,
      `mkdir -p /realness/h4a && cd /realness/h4a && i=0; while [ $i -lt ${count} ]; do echo $i > f$i; i=$((i+1)); done`,
      120
    )
    exec_file_sync('sh', ['-c', KILL.replaceAll('{pid}', String(actor.pid))], {
      stdio: 'ignore'
    })
    const reload = await call('POST', `/v1/actors/${actor.id}/reload`)
    assert.equal(reload.status, 200, reload.text)
    const empty = await sh(
      actor.id,
      `cd /realness/h4a || exit 9; ls | wc -l; find . -type f -empty | wc -l`
    )
    assert.equal(empty.code, 0, '/realness/h4a survived the stop')
    const [files, blank] = empty.out.trim().split(/\s+/).map(Number)
    assert.equal(files, count, 'every file exists')
    assert.equal(blank, 0, 'no file lost its contents')
    await destroy(actor.id)
  })
})
