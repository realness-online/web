import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync as mkdir_sync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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

const FIND =
  '<article itemscope itemtype="/find"><dl><dt>url</dt><dd><a itemprop="url" href="https://a.test/job">a</a></dd><dt>score</dt><dd><span itemprop="score">8</span></dd><dt>reason</dt><dd><span itemprop="reason">ownership, Vue</span></dd></dl></article>'

/** One scout page with the sources it names; `sources` is `[[title, url], ...]`. */
const add_scout = (
  vault,
  name,
  status,
  sources = [['Boards', 'https://a.test']]
) => {
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
  writeFileSync(
    join(folder, 'Sources.md'),
    sources
      .map(([title, url], at) => `## ${at + 1}. ${title}\n${url}\n`)
      .join('')
  )
}

/**
 * A door over one owner's vault, with a box store that runs the box's own
 * command: it writes the run's finds page, as `scout.js --run` does.
 */
const door_of = ({ root, vault, owner = '+14155550123', reply = FIND }) => {
  const record = {
    id: 'a-abcdef123456',
    owner,
    state: 'running',
    vsock_path: join(root, 'vsock.sock')
  }
  const commands = []
  const store = {
    live_actors: () => [record],
    get: () => record,
    list: () => [record],
    ensure_running: async () => record,
    host_vault: { owner, path: vault },
    free_bytes: () => 10 * 1024 ** 3,
    exec: async (id, argv, options) => {
      commands.push({ id, argv, options })
      return {
        exit_code: 0,
        stdout_b64: Buffer.from(`${reply}\n`).toString('base64'),
        stderr_b64: ''
      }
    }
  }
  const door = new Door(store)
  door.chrome = {
    reap: async () => [],
    pool: { restore: async () => ({ n: 1 }), destroy: async () => {} }
  }
  return { door, record, commands }
}

/** Send one door op over the actor's socket. */
const send_of = async (door, record, value) => {
  door.reconcile()
  const { path, server } = door.listeners.get(record.id)
  await new Promise(done =>
    server.listening ? done() : server.once('listening', done)
  )
  const reply = await new Promise((done, fail) => {
    const socket = connect(path)
    socket.once('error', fail)
    socket.once('connect', () => socket.write(`${JSON.stringify(value)}\n`))
    let answer = ''
    socket.on('data', data => {
      answer += data.toString()
    })
    socket.once('end', () => done(JSON.parse(answer)))
  })
  return { reply, close: () => new Promise(done => server.close(done)) }
}

/** Wait for every run the door started to finish, so teardown never races one. */
const settle = async (door, ms = 5000) => {
  const deadline = Date.now() + ms
  while (door.scouting.size && Date.now() < deadline)
    await new Promise(done => setTimeout(done, 10))
  return door.scouting.size === 0
}

it("a scout runs in the owner's box with the command the Mac runs", async () => {
  const root = mkdtempSync(out_path('door-box-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door, record, commands } = door_of({ root, vault })
  const { reply, close } = await send_of(door, record, { op: 'scouts' })
  try {
    assert.deepEqual(reply.scouts, ['Scouts/Realness boards'])
    assert.ok(await settle(door), 'the run ends')
    assert.equal(commands.length, 1, 'one run, one box command')
    assert.deepEqual(commands[0].argv, [
      '/usr/local/bin/realness-scouts',
      'Scouts/Realness',
      '--source',
      'boards'
    ])
    assert.equal(commands[0].id, record.id, "the owner's own box")
    assert.equal(commands[0].options.cwd, '/')
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('a caller tells the box which model its task wants', async () => {
  const root = mkdtempSync(out_path('door-model-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door, record, commands } = door_of({ root, vault })
  const { reply, close } = await send_of(door, record, {
    op: 'scout',
    scout: 'Realness',
    source: 'boards',
    model: 'realness/standard'
  })
  try {
    assert.equal(reply.model, 'realness/standard')
    assert.ok(await settle(door), 'the run ends')
    assert.deepEqual(commands[0].argv, [
      '/usr/local/bin/realness-scouts',
      'Scouts/Realness',
      '--source',
      'boards',
      '--model',
      'realness/standard'
    ])
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('a model name that is not one word never reaches the box', async () => {
  const root = mkdtempSync(out_path('door-model-bad-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door, record, commands } = door_of({ root, vault })
  const { close } = await send_of(door, record, {
    op: 'scout',
    scout: 'Realness',
    source: 'boards',
    model: 'realness/standard --source other'
  })
  try {
    assert.ok(await settle(door), 'the run ends')
    assert.deepEqual(commands, [], 'no box command ran')
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('the halo leaves the run folder and the leads note to the box', async () => {
  const root = mkdtempSync(out_path('door-merge-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door, record } = door_of({ root, vault })
  const { close } = await send_of(door, record, { op: 'scouts' })
  try {
    assert.ok(await settle(door), 'the run ends')
    const folder = join(vault, 'Projects/Scouts/Realness')
    assert.equal(existsSync(join(folder, 'Runs')), false, 'no halo run folder')
    assert.equal(existsSync(join(folder, 'Leads')), false, 'no halo leads note')
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('every source of a batch runs at once, in the box', async () => {
  const root = mkdtempSync(out_path('door-batch-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active', [
    ['Alpha', 'https://a.test/one'],
    ['Beta', 'https://b.test/two'],
    ['Gamma', 'https://c.test/three'],
    ['Delta', 'https://d.test/four'],
    ['Epsilon', 'https://e.test/five']
  ])
  const { door, record, commands } = door_of({ root, vault })
  const { reply, close } = await send_of(door, record, { op: 'scouts' })
  try {
    assert.equal(reply.scouts.length, 5, 'no source is dropped')
    assert.ok(await settle(door), 'the batch ends')
    assert.equal(commands.length, 5, 'each source is its own run')
    assert.deepEqual(commands.map(one => one.argv[3]).sort(), [
      'alpha',
      'beta',
      'delta',
      'epsilon',
      'gamma'
    ])
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('the timer starts one run and leaves the rest for the next tick', async () => {
  const root = mkdtempSync(out_path('door-timer-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door } = door_of({ root, vault })
  try {
    assert.deepEqual(await door.run_due_scouts(), ['Scouts/Realness boards'])
    assert.deepEqual(await door.run_due_scouts(), [], 'nothing while it runs')
  } finally {
    await settle(door)
    rmSync(root, { recursive: true, force: true })
  }
})

it("a scout on another owner's halo is refused", async () => {
  const root = mkdtempSync(out_path('door-owner-'))
  const vault = join(root, 'vault')
  add_scout(vault, 'Realness', 'active')
  const { door, record } = door_of({ root, vault })
  door.store.host_vault = { owner: '+14155559999', path: vault }
  const { reply, close } = await send_of(door, record, { op: 'scouts' })
  try {
    assert.equal(reply.ok, false)
    assert.match(reply.error, /owner's own halo/)
  } finally {
    await settle(door)
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})
