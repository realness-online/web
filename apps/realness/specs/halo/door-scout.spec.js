import assert from 'node:assert/strict'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { Door } from '../../src/halo/door.js'
import { scout_page } from '#root/src/scouts/scout.js'

mkdir_sync(out_path(), { recursive: true })

const add_scout = (vault, name, status) => {
  const folder = join(vault, 'Projects/Scouts', name)
  mkdir_sync(folder, { recursive: true })
  writeFileSync(
    join(folder, 'scout.html'),
    scout_page(name, {
      itemid: `/+1/scouts/${name.toLowerCase()}`,
      org: '+1',
      schedule: 'daily',
      minutes: 30,
      per_day: 1,
      status
    })
  )
  writeFileSync(join(folder, 'Profile.md'), '# profile\n')
  writeFileSync(join(folder, 'Sources.md'), '# sources\n')
}

it('the scout timer wakes the box and starts only the scouts with budget left', async () => {
  const root = mkdtempSync(out_path('door-timer-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const owner = '+14155550123'
  const box = { id: 'a-2', owner, state: 'stopped' }
  const woken = []
  const store = {
    host_vault: { owner, path: vault },
    list: () => [box, { id: 'L-1', owner, state: 'running' }],
    ensure_running: async id => {
      woken.push(id)
      box.state = 'running'
      return box
    },
    get: () => box
  }
  const door = new Door(store)
  door.loops = {
    loops: { 'L-1': { parent: box.id, depth: 1 } },
    start: async () => ({ id: 'L-2', depth: 1 })
  }
  try {
    assert.deepEqual(await door.run_due_scouts(), ['Scouts/Realness'])
    assert.deepEqual(woken, [box.id])
    assert.deepEqual(await door.run_due_scouts(), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('the door starts each active scout as a one-shot loop on the owner halo', async () => {
  const root = mkdtempSync(out_path('door-scout-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  add_scout(vault, 'SMS', 'paused')
  const record = {
    id: 'a-abcdef123456',
    owner: '+14155550123',
    vsock_path: join(root, 'vsock.sock')
  }
  const store = {
    live_actors: () => [record],
    get: () => record,
    host_vault: { owner: record.owner, path: vault }
  }
  const started = []
  store.free_bytes = () => 10 * 1024 ** 3
  const door = new Door(store)
  door.chrome = {
    reap: async () => [],
    pool: { restore: async () => ({ n: 1 }), destroy: async () => {} }
  }
  door.loops = {
    loops: {},
    start: async (parent, goal, options) => {
      started.push({ parent, goal, options })
      return { id: 'L', depth: 1 }
    }
  }
  door.reconcile()
  const { path, server } = door.listeners.get(record.id)
  await new Promise(done =>
    server.listening ? done() : server.once('listening', done)
  )
  const send = value =>
    new Promise((done, fail) => {
      const socket = connect(path)
      socket.once('error', fail)
      socket.once('connect', () => socket.write(`${JSON.stringify(value)}\n`))
      let answer = ''
      socket.on('data', data => {
        answer += data.toString()
      })
      socket.once('end', () => done(JSON.parse(answer)))
    })
  try {
    assert.deepEqual(await send({ op: 'scouts' }), {
      ok: true,
      scouts: ['Scouts/Realness']
    })
    const paused = await send({ op: 'scout', scout: 'SMS' })
    assert.equal(paused.ok, false)
    assert.match(paused.error, /paused/)
    await new Promise(done => setTimeout(done, 20))
    assert.equal(started.length, 1)
    assert.equal(started[0].parent, record.id)
    assert.match(
      started[0].goal,
      /^Read \/realness\/vault\/Projects\/Scouts\/Realness\/Runs\//
    )
    assert.deepEqual(started[0].options, {
      once: true,
      deadline_ms: 30 * 60_000,
      session_dir: `${started[0].goal.match(/Read (\S+)\/goal\.md/)[1]}/sessions`
    })
    store.host_vault = { owner: '+14155559999', path: vault }
    const elsewhere = await send({ op: 'scouts' })
    assert.equal(elsewhere.ok, false)
    assert.match(elsewhere.error, /owner's own halo/)
  } finally {
    await new Promise(done => server.close(done))
    rmSync(root, { recursive: true, force: true })
  }
})
