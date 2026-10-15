/**
 * hs-n2: a person's host is chosen once and read back after that, so a person
 * never moves because the list of hosts changed.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  placement,
  placement_html,
  placement_key,
  placed_hosts,
  release_placements,
  read_placement,
  reassign
} from '../../src/gate/placement.js'

const phone = '+14155550123'
const other = '+14155550124'

const store = (records = new Map()) => ({
  records,
  read: async key => {
    const body = records.get(key)
    return body === undefined ? null : { body: Buffer.from(body) }
  },
  write: async (key, body) => records.set(key, body)
})

test('the record keeps a phone, a host, and when it was placed', () => {
  const html = placement_html({
    phone,
    host: 'realness-1',
    placed: '2026-10-15T00:00:00.000Z'
  })
  assert.match(html, /itemtype="\/placement"/)
  assert.deepEqual(read_placement(html), {
    phone,
    host: 'realness-1',
    placed: '2026-10-15T00:00:00.000Z'
  })
  assert.equal(read_placement('<p>not a placement</p>'), null)
  assert.equal(
    read_placement(html.replace('realness-1', 'Bad Host')),
    null,
    'a record naming a host that is not a host name is not a placement'
  )
  assert.throws(
    () => placement_html({ phone, host: 'Bad Host', placed: 'x' }),
    /bad host name/
  )
  assert.equal(placement_key(phone), 'placements/14155550123.html')
})

test('the same phone always lands on the same host', async () => {
  const one = store()
  const hosts = ['realness-1', 'realness-2', 'realness-3']
  const first = await placement(phone, { hosts, ...one })
  const again = await placement(phone, { hosts, ...one })
  assert.equal(first.host, again.host)
  assert.equal(again.placed, false)
  assert.equal(one.records.size, 1, 'written once')
})

test('a placed person keeps their host when the list changes', async () => {
  const one = store()
  const first = await placement(phone, {
    hosts: ['realness-1', 'realness-2'],
    ...one
  })
  const after = await placement(phone, {
    hosts: ['realness-2', 'realness-1', 'realness-9'],
    ...one
  })
  assert.equal(after.host, first.host)
  assert.equal(after.placed, false)
})

test('the same list always picks the same host, whatever the order', async () => {
  const hosts = ['realness-1', 'realness-2', 'realness-3']
  const sorted = await placement(other, { hosts, ...store() })
  const shuffled = await placement(other, {
    hosts: [...hosts].reverse(),
    ...store()
  })
  assert.equal(shuffled.host, sorted.host)
  assert.ok(hosts.includes(sorted.host))
  assert.ok(
    hosts.some(host => host !== sorted.host),
    'a real pick, not always the first'
  )
})

test('a retired host, a bad phone, and an empty list are refused', async () => {
  const one = store()
  await placement(phone, { hosts: ['realness-1'], ...one })
  await assert.rejects(
    placement(phone, { hosts: ['realness-7'], ...one }),
    /realness-1 no longer serves anyone/
  )
  await assert.rejects(
    placement('nope', { hosts: ['realness-1'], ...one }),
    /bad phone number/
  )
  await assert.rejects(
    placement(phone, { hosts: [], ...one }),
    /no hosts are configured/
  )
})

test('reassign moves a placed person, and refuses one with no placement', async () => {
  const one = store()
  await placement(phone, { hosts: ['realness-1', 'realness-2'], ...one })
  const moved = await reassign(phone, 'realness-2', one)
  assert.equal(moved.host, 'realness-2')
  assert.equal(
    read_placement(one.records.get(placement_key(phone))).host,
    'realness-2'
  )
  await assert.rejects(
    reassign('+14155550199', 'realness-2', one),
    /no placement to move/
  )
})

test('the gate reaches the placed host at its own address', async () => {
  const store_one = store()
  const host_for = placed_hosts({
    addresses: {
      'realness-1': { host: '10.0.0.1', port: 8081, api_port: 8080 },
      'realness-2': { host: '10.0.0.2', port: 8081, api_port: 8080 }
    },
    ...store_one
  })
  const first = await host_for(phone)
  assert.deepEqual(first, await host_for(phone))
  assert.ok(['10.0.0.1', '10.0.0.2'].includes(first.host))
  assert.equal(first.api_port, 8080)
  assert.throws(
    () => placed_hosts({ addresses: { 'realness-1': { host: 'h' } } }),
    /bad address for realness-1/
  )
})

test('hs-n4: releasing a host drops only its own placements', async () => {
  const records = new Map()
  const one = store(records)
  await placement(phone, { hosts: ['realness-1'], ...one })
  await placement(other, { hosts: ['realness-1'], ...one })
  records.set(
    placement_key('+14155550188'),
    placement_html({ phone: '+14155550188', host: 'realness-2', placed: 'x' })
  )
  const released = await release_placements('realness-1', {
    list: async () => [...records.keys()],
    read: one.read,
    remove: async key => records.delete(key)
  })
  assert.equal(released, 2)
  assert.deepEqual([...records.keys()], [placement_key('+14155550188')])
  assert.equal(
    await release_placements('realness-9', {
      list: async () => [...records.keys()],
      read: one.read,
      remove: async key => records.delete(key)
    }),
    0
  )
  await assert.rejects(
    release_placements('Not A Host', {
      list: async () => [],
      read: one.read,
      remove: async () => {}
    }),
    /bad host name/
  )
})
