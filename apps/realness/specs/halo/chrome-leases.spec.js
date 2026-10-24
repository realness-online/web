import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { ChromeLeases, lease_rules } from '../../src/halo/chrome-leases.js'
import { copy_net, namespace_commands } from '../../src/halo/chrome-pool.js'
import { Door } from '../../src/halo/door.js'

const fake_pool = ({ delay = 0 } = {}) => {
  let next = 0
  const pool = {
    live: new Set(),
    destroyed: [],
    async restore() {
      const n = ++next
      pool.live.add(n)
      if (delay) await new Promise(done => setTimeout(done, delay))
      const { address } = copy_net(n)
      return { n, address, devtools: `http://${address}:9222` }
    },
    async destroy(n) {
      pool.live.delete(n)
      pool.destroyed.push(n)
    }
  }
  return pool
}
const fake_firewall = () => {
  const open = new Set()
  return {
    open,
    firewall: {
      open: (a, c) => open.add(`${a}>${c}`),
      close: (a, c) => open.delete(`${a}>${c}`)
    }
  }
}

it("each copy gets its own namespace and outside address; the guest stays the seed's", () => {
  assert.deepEqual(copy_net(3), {
    ns: 'brc-3',
    outside: 'brc-3-o',
    inside: 'brc-3-i',
    gateway: '172.19.3.1',
    address: '172.19.3.2'
  })
  assert.throws(() => copy_net(0))
  assert.throws(() => copy_net(251))
  const commands = namespace_commands(3).map(c => c.join(' '))
  assert.ok(
    commands.includes(
      'ip netns exec brc-3 iptables -t nat -A PREROUTING -i brc-3-i -j DNAT --to-destination 172.18.1.2'
    )
  )
  assert.ok(
    commands.includes(
      'ip netns exec brc-3 ip tuntap add dev fc-chrome1 mode tap'
    ),
    "the seed's TAP name, inside the namespace"
  )
})

it('lease rules open the actor to DevTools and the copy to the actor, nothing wider', () => {
  const rules = lease_rules('172.16.4.2', '172.19.1.2').map(r => r.join(' '))
  assert.equal(rules.length, 4)
  assert.ok(
    rules[0].startsWith('-s 172.16.4.2 -d 172.19.1.2 -p tcp --dport 9222')
  )
  assert.ok(rules[1].startsWith('-s 172.19.1.2 -d 172.16.4.2 -p tcp'))
  for (const rule of rules)
    (assert.match(rule, /172\.16\.4\.2/), assert.match(rule, /172\.19\.1\.2/))
})

it('a lease opens the firewall; returning destroys the copy and closes it', async () => {
  const pool = fake_pool()
  const { open, firewall } = fake_firewall()
  const leases = new ChromeLeases(pool, { firewall })
  const lease = await leases.lease('a-1', '172.16.4.2')
  assert.equal(lease.devtools, 'http://172.19.1.2:9222')
  assert.deepEqual([...open], ['172.16.4.2>172.19.1.2'])
  assert.equal(await leases.give_back('a-1'), true)
  assert.deepEqual([pool.destroyed, [...open]], [[1], []])
  assert.equal(await leases.give_back('a-1'), false, 'nothing left to return')
})

it('leasing again replaces the copy; a copy is never handed out twice', async () => {
  const pool = fake_pool()
  const { open, firewall } = fake_firewall()
  const leases = new ChromeLeases(pool, { firewall })
  await leases.lease('a-1', '172.16.4.2')
  const second = await leases.lease('a-1', '172.16.4.2')
  assert.equal(second.devtools, 'http://172.19.2.2:9222')
  assert.deepEqual(
    [pool.destroyed, [...pool.live], [...open]],
    [[1], [2], ['172.16.4.2>172.19.2.2']]
  )
})

it('leases end with their time or their actor', async () => {
  let now = 0
  const pool = fake_pool()
  const { open, firewall } = fake_firewall()
  const leases = new ChromeLeases(pool, {
    firewall,
    minutes: 30,
    now: () => now
  })
  await leases.lease('a-old', '172.16.4.2')
  await leases.lease('a-gone', '172.16.5.2')
  await leases.lease('a-ok', '172.16.6.2')
  now = 10 * 60_000
  assert.deepEqual(await leases.reap(['a-old', 'a-ok']), ['a-gone'])
  now = 31 * 60_000
  assert.deepEqual(await leases.reap(['a-old', 'a-ok']), ['a-old', 'a-ok'])
  assert.deepEqual([pool.live.size, open.size], [0, 0])
})

it('a lease returned while its copy restores is destroyed on arrival', async () => {
  const pool = fake_pool({ delay: 30 })
  const { open, firewall } = fake_firewall()
  const leases = new ChromeLeases(pool, { firewall })
  const pending = leases.lease('a-1', '172.16.4.2')
  assert.equal(await leases.give_back('a-1'), true)
  await assert.rejects(pending, /returned before it was ready/)
  assert.deepEqual([pool.live.size, open.size], [0, 0])
})

it('the door leases and returns Chrome for its own actor only', async () => {
  mkdir_sync(out_path(), { recursive: true })
  const root = mkdtempSync(out_path('door-chrome-'))
  const record = {
    id: 'a-abcdef123456',
    owner: '+14155550123',
    tap: 'fc-tap4',
    vsockPath: join(root, 'vsock.sock')
  }
  const store = { liveActors: () => [record], get: () => record }
  const pool = fake_pool()
  const { open, firewall } = fake_firewall()
  const door = new Door(
    store,
    '/s/{id}/',
    null,
    new ChromeLeases(pool, { firewall })
  )
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
      socket.on('data', data => (answer += data.toString()))
      socket.once('end', () => done(JSON.parse(answer)))
    })
  try {
    const lease = await send({ op: 'chrome-lease' })
    assert.equal(lease.ok, true)
    assert.equal(lease.devtools, 'http://172.19.1.2:9222')
    assert.deepEqual(
      [...open],
      ['172.16.4.2>172.19.1.2'],
      "the actor's own TAP address, never a claimed one"
    )
    assert.deepEqual(await send({ op: 'chrome-return' }), {
      ok: true,
      returned: true
    })
    assert.deepEqual([pool.destroyed, [...open]], [[1], []])
    record.owner = null
    assert.equal((await send({ op: 'chrome-lease' })).ok, false)
    door.chrome = null
    record.owner = '+14155550123'
    assert.match((await send({ op: 'chrome-lease' })).error, /no chrome pool/)
  } finally {
    await new Promise(done => server.close(done))
    rmSync(root, { recursive: true, force: true })
  }
})

it('a lease holds its actor busy until returned, released once', async () => {
  const held = []
  const work = {
    beginWork: (id, key) => held.push(`+${id} ${key}`),
    endWork: (id, key) => held.push(`-${id} ${key}`)
  }
  const leases = new ChromeLeases(fake_pool(), {
    firewall: fake_firewall().firewall,
    work
  })
  await leases.lease('a-1', '172.16.4.2')
  await leases.give_back('a-1')
  await leases.give_back('a-1')
  assert.deepEqual(held, ['+a-1 browser', '-a-1 browser'])
})
