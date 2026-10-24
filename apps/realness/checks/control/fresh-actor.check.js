import assert from 'node:assert/strict'
import { spawn, spawnSync as spawn_sync } from 'node:child_process'
import {
  createHash as create_hash,
  createHmac as create_hmac,
  randomUUID as random_uuid
} from 'node:crypto'
import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { client } from '#root/src/files/client.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { out_path } from '#root/lib/output.js'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const PORT = Number(process.env.SYNC_PORT ?? 18095)
const owner = '+14156667777'
const root = new URL('../..', import.meta.url).pathname
const secret = read_file_sync(out_path('halo-pass-secret'), 'utf8').trim()
const run = `fresh-actor-${random_uuid().slice(0, 8)}`
const data = out_path(run)
const hash = text => create_hash('sha256').update(text).digest('hex')
const made = new Map()
let sync

const haloPass = (phone = owner) => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
      phone,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
}
const harness_pass = (phone, id) =>
  issue_harness_pass({ phone, id }, secret, Date.now() - 1000)

const call = async (method, path, body, phone = owner) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${haloPass(phone)}`,
      ...(body && { 'content-type': 'application/json' })
    },
    body: body && JSON.stringify(body)
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    json: text.startsWith('{') ? JSON.parse(text) : undefined
  }
}
const create = async (body = {}, phone = owner) => {
  const result = await call('POST', '/v1/actors', body, phone)
  assert.equal(result.status, 201, result.text)
  made.set(result.json.id, phone)
  return result.json.id
}
const sh = async (id, command, phone = owner) => {
  const result = await call(
    'POST',
    `/v1/actors/${id}/exec`,
    { argv: ['/bin/sh', '-c', command], timeout: 120 },
    phone
  )
  assert.equal(result.status, 200, result.text)
  const text = b64 => Buffer.from(b64, 'base64').toString()
  return {
    code: result.json.exit_code,
    out: text(result.json.stdout_b64),
    err: text(result.json.stderr_b64)
  }
}
const put = (path, body) => {
  const file = join(data, 'people', owner, path)
  mkdir_sync(dirname(file), { recursive: true })
  write_file_sync(file, body)
}
const recover = id =>
  sh(
    id,
    `realness-recover "http://$(ip route | awk '/default/{print $3; exit}'):${PORT}"`
  )

before(async () => {
  const call = {
    type: 'message',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'toolCall',
          id: 'c1',
          name: 'edit',
          arguments: {
            path: 'doc.md',
            edits: [{ oldText: 'body', newText: 'BODY' }]
          }
        }
      ]
    }
  }
  const at = n => new Date(Date.UTC(2026, 8, 27, 0, 0, n)).toISOString()
  const session = [
    {
      type: 'session',
      version: 3,
      id: random_uuid(),
      timestamp: at(0),
      cwd: '/realness'
    },
    {
      type: 'message',
      id: 'm0000001',
      parentId: null,
      timestamp: at(1),
      message: {
        role: 'user',
        content: [{ type: 'text', text: `remember ${run}` }],
        timestamp: Date.parse(at(1))
      }
    },
    {
      type: 'message',
      id: 'm0000002',
      parentId: 'm0000001',
      timestamp: at(2),
      ...call
    }
  ]
  put(
    '.pi/agent/sessions/--realness--/s.jsonl',
    `${session.map(entry => JSON.stringify(entry)).join('\n')}\n`
  )
  put('vault/Projects/fresh.md', '# Fresh\n\n## Syncs\n\n- work/notes\n')
  put('work/notes/doc.md', 'title\nbody\n')
  put('work/other/skip.md', 'not declared')
  put('vault/limited.md', 'for a limited actor')
  put('.pi/agent/auth.json', 'SECRET')
  put(
    '.pi/agent/deferred.json',
    JSON.stringify({
      'work/notes/doc.md': {
        base_sha: hash('title\nbody\n'),
        target_sha: hash('title\nBODY\n'),
        calls: [{ session: '--realness--/s.jsonl', tool_call: 'c1' }]
      }
    })
  )
  sync = spawn(
    'limactl',
    [
      'shell',
      'fc-local',
      '--',
      'sh',
      '-c',
      `echo $ > /artifacts/realness/${run}/sync.pid; exec env HALO_PASS_SECRET=${secret} LISTEN=0.0.0.0 PORT=${PORT} SYNC_DIR=/artifacts/realness/${run} node /mnt/fc/server/sync/bin/sync-service.js --dev`
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  )
  await new Promise((ready, fail) => {
    sync.stdout.on(
      'data',
      chunk => chunk.toString().includes('# sync service on') && ready()
    )
    sync.on('exit', code => fail(new Error(`sync service exited ${code}`)))
  })
})

after(async () => {
  for (const [id, phone] of made)
    await call('DELETE', `/v1/actors/${id}`, undefined, phone)
  const pid = read_file_sync(join(data, 'sync.pid'), 'utf8').trim()
  if (/^\d+$/.test(pid))
    spawn_sync('limactl', ['shell', 'fc-local', '--', 'kill', pid], {
      stdio: 'ignore'
    })
  sync?.kill()
  rm_sync(data, { recursive: true, force: true })
})

test("a fresh actor pulls its owner's saved files and replays the pending edit", async () => {
  const id = await create()
  const result = await recover(id)
  assert.equal(result.code, 0, result.err)
  assert.match(result.out, /replayed 1 pending edits/)
  assert.equal(
    (await sh(id, 'cat /realness/work/notes/doc.md')).out,
    'title\nBODY\n'
  )
  const opened = await sh(
    id,
    `cd /realness && mkdir -p artifacts && pi --export .pi/agent/sessions/--realness--/s.jsonl artifacts/history.html && node -e 'const html = require("node:fs").readFileSync("artifacts/history.html", "utf8"); const encoded = html.match(/id=.session-data[^>]*>([^<]*)/)[1]; process.stdout.write(Buffer.from(encoded, "base64").toString())'`
  )
  assert.equal(opened.code, 0, opened.err)
  assert.match(opened.out, new RegExp(run), 'Pi opens the old history')
  assert.notEqual(
    (await sh(id, 'test -e /realness/work/other/skip.md')).code,
    0,
    'undeclared folders stay behind'
  )
  assert.notEqual(
    (await sh(id, 'grep -q SECRET /realness/.pi/agent/auth.json')).code,
    0,
    'secrets never travel'
  )
})

test('a limited actor pulls only its listed paths', async () => {
  const id = await create({ paths: ['vault/limited.md'] })
  const result = await recover(id)
  assert.equal(result.code, 0, result.err)
  assert.equal(
    (await sh(id, 'cat /realness/vault/limited.md')).out,
    'for a limited actor'
  )
  assert.notEqual((await sh(id, 'test -e /realness/work/notes/doc.md')).code, 0)
})

test('the halo refuses a path list that names secrets', async () => {
  const result = await call('POST', '/v1/actors', {
    paths: ['.pi/agent/auth.json']
  })
  assert.equal(result.status, 400, result.text)
})

test('a fresh actor updates stock files and keeps personal edits and deletions', async () => {
  const id = await create()
  const installed = await sh(
    id,
    'cat /usr/local/share/realness-starter/.pi/starter.json'
  )
  assert.equal(installed.code, 0, installed.err)
  const latest = JSON.parse(installed.out)
  const removed = 'prompts/site.md'
  assert.ok(latest.files.LICENSE)
  assert.ok(latest.files['README.md'])
  assert.ok(latest.files[removed])
  const original = (
    await sh(id, 'cat /usr/local/share/realness-starter/LICENSE')
  ).out
  put('harness/.ignore', '')
  put(
    'harness/.pi/starter.json',
    JSON.stringify({
      version: hash('previous starter'),
      built_at: '2026-09-01T00:00:00.000Z',
      files: {
        LICENSE: hash('old license'),
        'README.md': hash('old readme'),
        [removed]: hash('old prompt')
      }
    })
  )
  put('harness/LICENSE', 'old license')
  put('harness/README.md', 'personal readme')
  const result = await recover(id)
  assert.equal(result.code, 0, result.err)
  assert.equal((await sh(id, 'cat /realness/LICENSE')).out, original)
  assert.equal((await sh(id, 'cat /realness/README.md')).out, 'personal readme')
  assert.notEqual((await sh(id, `test -e /realness/${removed}`)).code, 0)
  const saved = (await sh(id, 'cat /realness/.pi/starter.json')).out
  assert.equal(JSON.parse(saved).version, latest.version)
})

test('a1: two accounts sync the static example privately', async () => {
  const example = JSON.parse(
    read_file_sync(join(root, 'tools/publish/renderer/site.json'), 'utf8')
  )
  const source = read_file_sync(
    join(root, 'tools/publish/renderer/build.js')
  ).toString('base64')
  const desktop = new URL(
    `../../../../../artifacts/realness/${run}-apps/`,
    import.meta.url
  ).pathname
  const accounts = []
  try {
    for (const [index, phone] of [owner, '+14156667778'].entries()) {
      const id = await create({}, phone)
      const folder = await sh(
        id,
        'test -d /realness/apps && test -f /realness/.ignore',
        phone
      )
      assert.equal(
        folder.code,
        0,
        'new actors have private apps and sync defaults'
      )
      const config = JSON.stringify({ ...example, name: `Account ${index}` })
      const encoded = Buffer.from(config).toString('base64')
      const pushed = await sh(
        id,
        `cd /realness && mkdir -p apps/site && printf '%s' '${encoded}' | base64 -d > apps/site/site.json && printf '%s' '${source}' | base64 -d > apps/site/build.js && chown -R realness:realness apps/site && SYNC_URL="http://$(ip route | awk '/default/{print $3; exit}'):${PORT}" runuser -u realness -- realness sync`,
        phone
      )
      assert.equal(pushed.code, 0, pushed.err)
      const store = client({
        url: `http://127.0.0.1:${PORT}`,
        phone,
        token: harness_pass(phone, id)
      })
      const local = join(desktop, String(index))
      await store.sync(local, 'can://~/harness/apps/', {
        state: join(desktop, `${index}-state`)
      })
      assert.deepEqual(
        JSON.parse(read_file_sync(join(local, 'site/site.json'), 'utf8')),
        JSON.parse(config)
      )
      assert.equal(
        read_file_sync(join(local, 'site/build.js')).toString('base64'),
        source
      )
      accounts.push({ store, phone })
    }
    for (const [index, { store }] of accounts.entries()) {
      const stranger = accounts[1 - index].phone
      const path = `can://people/${stranger}/harness/apps/site/site.json`
      await assert.rejects(store.cat(path), { status: 403 })
      await assert.rejects(store.put(path, 'overwrite'), { status: 403 })
    }
  } finally {
    rm_sync(desktop, { recursive: true, force: true })
  }
})

test('an actor turn sends a file edit back to the desktop', async () => {
  put('harness/.ignore', '')
  put('harness/vault/return.md', 'desktop original\n')
  const id = await create()
  const recovered = await recover(id)
  assert.equal(recovered.code, 0, recovered.err)
  const synced = await sh(
    id,
    'cd /realness && runuser -u realness -- realness sync'
  )
  assert.equal(synced.code, 0, synced.err)
  const desktop = new URL(
    `../../../../../artifacts/realness/${run}-desktop/`,
    import.meta.url
  ).pathname
  const state = `${desktop}-state`
  const store = client({
    url: `http://127.0.0.1:${PORT}`,
    phone: owner,
    token: harness_pass(owner, id)
  })
  try {
    await store.sync(desktop, 'can://~/harness/', { state })
    assert.equal(
      read_file_sync(join(desktop, 'vault/return.md'), 'utf8'),
      'desktop original\n'
    )
    const changed = await sh(
      id,
      `cd /realness && runuser -u realness -- realness turn-start --session return-check && printf 'VM change\\n' > vault/return.md && runuser -u realness -- realness turn-end --session return-check --turn 1`
    )
    assert.equal(changed.code, 0, changed.err)
    await store.sync(desktop, 'can://~/harness/', { state })
    assert.equal(
      read_file_sync(join(desktop, 'vault/return.md'), 'utf8'),
      'VM change\n'
    )
  } finally {
    rm_sync(desktop, { recursive: true, force: true })
    rm_sync(state, { recursive: true, force: true })
  }
})
