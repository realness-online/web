import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BoxStore } from '../../src/halo/box.js'
import * as vsock from '../../src/halo/vsock.js'
import { DISK_AFTER, MEMORY_AFTER } from '../../src/halo/lifecycle.js'
import {
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync,
  statSync as stat_sync,
  chmodSync as chmod_sync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { join } from 'node:path'

const volume = mkdtemp_sync(join(tmpdir(), 'box-store-'))
// Root in a box is uid 100000 on the VM; it has to reach its bundle.
chmod_sync(volume, 0o755)
const has_template =
  exists_sync('/opt/fc/template.ext4') && process.getuid?.() === 0
const maybe = has_template ? test : test.skip

/** One chat command over the halo's channel, the way server.js dials it. */
const chat_once = async record => {
  const chat = await vsock.connect(record.vsock_path, 55)
  const events = []
  try {
    chat.socket.write(
      `${JSON.stringify({ command: 'thinking', args: 'high' })}\n`
    )
    let line
    while ((line = await chat.lines.read(120))) events.push(JSON.parse(line))
    return events
  } finally {
    chat.socket.destroy()
  }
}

/** Retry while Pi's chat extension reports it is still starting. */
const chat_command = async record => {
  const deadline = Date.now() + 60_000
  for (;;) {
    const events = await chat_once(record)
    const starting = events.some(event =>
      /still starting/.test(event.text ?? '')
    )
    if (!starting || Date.now() > deadline) {
      assert.ok(
        events.some(event => event.type === 'done'),
        JSON.stringify(events)
      )
      return events
    }
    await new Promise(done => setTimeout(done, 500))
  }
}

maybe('BoxStore: create, chat, idle, reload, destroy', async t => {
  const store = new BoxStore({
    volume,
    template: '/opt/fc/template.ext4',
    sync_url: null
  })
  t.after(async () => {
    for (const actor of store.list()) await store.destroy(actor.id)
  })
  const record = await store.create('+16282281824')
  assert.ok(record.id.startsWith('a-'))
  assert.equal(record.state, 'running')

  const result = await store.exec(record.id, ['/bin/echo', 'hello-box'])
  assert.equal(result.exit_code, 0)
  assert.equal(
    Buffer.from(result.stdout_b64, 'base64').toString().trim(),
    'hello-box'
  )

  const events = await chat_command(record)
  assert.ok(!events.some(event => event.type === 'error'))
  assert.equal(typeof store.first_turn(record.id), 'number')
  assert.ok(store.trace_of(record.id).some(row => row.event === 'first-turn'))

  const active = store.get(record.id)
  await store.sweep({
    now: Date.parse(active.last_activity) + MEMORY_AFTER
  })
  assert.equal(store.get(record.id).state, 'idle')
  assert.equal((await store.exec(record.id, ['/bin/true'])).exit_code, 0)
  assert.ok(
    store
      .trace_of(record.id)
      .some(row => row.event === 'reload' && row.from_memory)
  )

  const warm = store.get(record.id)
  await store.sweep({ now: Date.parse(warm.last_activity) + MEMORY_AFTER })
  await store.sweep({ now: Date.parse(warm.last_activity) + DISK_AFTER })
  assert.equal(store.get(record.id).state, 'stopped')

  await store.reload(record.id)
  assert.ok(!(await chat_command(record)).some(event => event.type === 'error'))
  await store.destroy(record.id)
  assert.equal(exists_sync(join(volume, record.id, 'actor.json')), false)
})

/** One terminal connection: send `frames`, collect output text for `ms`. */
const terminal = async (record, frames, ms = 1500) => {
  const pty = await vsock.connect(record.pty_path, 53)
  let text = ''
  const ops = []
  pty.socket.on('data', chunk => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      try {
        const message = JSON.parse(line)
        ops.push(message.op)
        if (message.data_b64)
          text += Buffer.from(message.data_b64, 'base64').toString()
      } catch {}
    }
  })
  for (const message of frames) pty.socket.write(`${JSON.stringify(message)}\n`)
  await new Promise(done => setTimeout(done, ms))
  pty.socket.destroy()
  return { text, ops }
}

const typed = keys => ({
  op: 'data',
  data_b64: Buffer.from(keys).toString('base64')
})

maybe(
  'BoxStore: a named session keeps its shell across connections',
  async t => {
    const store = new BoxStore({
      volume,
      template: '/opt/fc/template.ext4',
      sync_url: null
    })
    t.after(async () => {
      for (const actor of store.list()) await store.destroy(actor.id)
    })
    const record = await store.create('+16282281824')
    const session = { op: 'session', name: 's2' }
    const first = await terminal(record, [session, typed('echo pane-pid=$$\r')])
    const pid = /pane-pid=(\d+)/.exec(first.text)?.[1]
    assert.ok(pid, first.text)
    const again = await terminal(record, [session, typed('echo pane-pid=$$\r')])
    assert.equal(/pane-pid=(\d+)/.exec(again.text)?.[1], pid)
    const pi = await store.exec(record.id, ['pgrep', '-x', 'pi'])
    assert.equal(pi.exit_code, 0, 'Pi still runs in the main terminal')
    const closed = await terminal(record, [session, { op: 'close' }])
    assert.ok(closed.ops.includes('exit'), JSON.stringify(closed.ops))
    const fresh = await terminal(record, [session, typed('echo pane-pid=$$\r')])
    assert.notEqual(/pane-pid=(\d+)/.exec(fresh.text)?.[1], pid)
    const bad = await terminal(record, [{ op: 'session', name: '../x' }], 500)
    assert.ok(bad.ops.includes('error'))
  }
)

maybe(
  'BoxStore: the owner works on the host vault; Sessions stay hidden',
  async t => {
    const vault = join(volume, 'host-vault')
    mkdir_sync(join(vault, 'Sessions'), { recursive: true })
    mkdir_sync(join(vault, 'Areas'), { recursive: true })
    write_file_sync(join(vault, 'Areas', 'garden.md'), 'tomatoes')
    write_file_sync(join(vault, 'Sessions', 'old.html'), 'a session')
    exec_file_sync('chown', ['-R', '501:1000', vault])
    const owner = '+16282281824'
    const store = new BoxStore({
      volume,
      template: '/opt/fc/template.ext4',
      sync_url: null,
      host_vault: { path: vault, owner }
    })
    t.after(async () => {
      for (const actor of store.list()) await store.destroy(actor.id)
    })
    const mine = await store.create(owner)
    const run = async (record, script) => {
      const result = await store.exec(record.id, [
        'su',
        'realness',
        '-c',
        script
      ])
      return Buffer.from(result.stdout_b64, 'base64').toString().trim()
    }
    assert.equal(
      await run(mine, 'cat /realness/vault/Areas/garden.md'),
      'tomatoes'
    )
    assert.equal(await run(mine, 'ls -A /realness/vault/Sessions | wc -l'), '0')
    await run(mine, 'printf beans > /realness/vault/Areas/beans.md')
    assert.equal(
      read_file_sync(join(vault, 'Areas', 'beans.md'), 'utf8'),
      'beans'
    )
    assert.equal(stat_sync(join(vault, 'Areas', 'beans.md')).uid, 501)
    assert.equal(
      read_file_sync(join(vault, 'Sessions', 'old.html'), 'utf8'),
      'a session'
    )
    const neighbor = await store.create('+14155550199')
    assert.equal(
      await run(
        neighbor,
        'test -e /realness/vault/Areas/garden.md && echo seen || echo hidden'
      ),
      'hidden'
    )
  }
)

test('BoxStore: seed_status reflects the template', () => {
  const store = new BoxStore({ volume, template: '/opt/fc/template.ext4' })
  const status = store.seed_status()
  assert.equal(status.matches, true)
})

test('BoxStore: owner required', async () => {
  const store = new BoxStore({ volume, template: '/opt/fc/template.ext4' })
  await assert.rejects(() => store.create('nobody'), /verified owner/)
})

test('cleanup', () => {
  rm_sync(volume, { recursive: true, force: true })
})

test('sweep removes a dead create, but not one in flight', async () => {
  const root = mkdtemp_sync(join(tmpdir(), 'box-sweep-'))
  const store = new BoxStore({ volume: root, template: '', runc: 'true' })
  for (const name of ['a-000000000001', 'a-000000000002', 'keep-me'])
    mkdir_sync(join(root, name, 'root'), { recursive: true })
  store.creating.add('a-000000000002')
  const done = await store.sweep()
  assert.deepEqual(done, [{ id: 'a-000000000001', step: 'remove' }])
  assert.equal(exists_sync(join(root, 'a-000000000001')), false)
  assert.equal(exists_sync(join(root, 'a-000000000002')), true)
  assert.equal(exists_sync(join(root, 'keep-me')), true)
  rm_sync(root, { recursive: true, force: true })
})

maybe(
  'BoxStore: root in a box is unprivileged on the VM, and limited',
  async t => {
    const store = new BoxStore({
      volume,
      template: '/opt/fc/template.ext4',
      sync_url: null
    })
    t.after(async () => {
      for (const actor of store.list()) await store.destroy(actor.id)
    })
    const record = await store.create('+14155550123')
    const map = await store.exec(record.id, ['cat', '/proc/self/uid_map'])
    assert.deepEqual(
      Buffer.from(map.stdout_b64, 'base64').toString().trim().split(/\s+/),
      ['0', '100000', '65536']
    )
    const { pid } = store.get(record.id)
    assert.ok(pid > 0, 'the record names the box init pid')
    assert.equal(stat_sync(`/proc/${pid}`).uid, 100000)
    const cgroup = read_file_sync(`/proc/${pid}/cgroup`, 'utf8')
      .trim()
      .split(':')
      .at(-1)
    const limit = name =>
      read_file_sync(join('/sys/fs/cgroup', cgroup, name), 'utf8').trim()
    assert.equal(limit('memory.max'), String(1536 * 1024 * 1024))
    assert.equal(limit('pids.max'), '1024')
    assert.equal(limit('cpu.max'), '200000 100000')
  }
)

maybe('BoxStore: a pane running a job keeps the box awake', async t => {
  const store = new BoxStore({
    volume,
    template: '/opt/fc/template.ext4',
    sync_url: null
  })
  t.after(async () => {
    for (const actor of store.list()) await store.destroy(actor.id)
  })
  const record = await store.create('+14155550123')
  const session = { op: 'session', name: 'job' }
  await terminal(record, [session, typed('echo ready\r')])
  const busy = async () =>
    Buffer.from(
      (await store.exec(record.id, ['/usr/local/bin/realness-pty', 'busy']))
        .stdout_b64,
      'base64'
    )
      .toString()
      .trim()
  assert.equal(await busy(), '', 'a waiting shell is not busy')
  await terminal(record, [session, typed('sleep 120\r')])
  assert.equal(await busy(), 'job')
  const stale = Date.parse(store.get(record.id).last_activity) + DISK_AFTER
  assert.deepEqual(await store.sweep({ now: stale }), [])
  assert.notEqual(store.get(record.id).state, 'stopped')
})
