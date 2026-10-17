/**
 * hs-n2: a person's halo is chosen once and read back after that, so a person
 * never moves because the list of halos changed.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  placement,
  placement_html,
  placement_key,
  placed_halos,
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

test('the record keeps a phone, a halo, and when it was placed', () => {
  const html = placement_html({
    phone,
    halo: 'realness-1',
    placed: '2026-10-15T00:00:00.000Z'
  })
  assert.match(html, /itemtype="\/placement"/)
  assert.deepEqual(read_placement(html), {
    phone,
    halo: 'realness-1',
    placed: '2026-10-15T00:00:00.000Z'
  })
  assert.equal(read_placement('<p>not a placement</p>'), null)
  assert.equal(
    read_placement(html.replace('realness-1', 'Bad Halo')),
    null,
    'a record naming a halo that is not a halo name is not a placement'
  )
  assert.throws(
    () => placement_html({ phone, halo: 'Bad Halo', placed: 'x' }),
    /bad halo name/
  )
  assert.equal(placement_key(phone), 'placements/14155550123.html')
})

test('a record written under the old halo field still reads', () => {
  const legacy =
    '<article itemscope itemtype="/placement">' +
    `<meta itemprop="phone" content="${phone}">` +
    '<meta itemprop="halo" content="realness-1">' +
    '<meta itemprop="placed" content="x">' +
    '</article>\n'
  assert.deepEqual(read_placement(legacy), {
    phone,
    halo: 'realness-1',
    placed: 'x'
  })
})

test('the same phone always lands on the same halo', async () => {
  const one = store()
  const halos = ['realness-1', 'realness-2', 'realness-3']
  const first = await placement(phone, { halos, ...one })
  const again = await placement(phone, { halos, ...one })
  assert.equal(first.halo, again.halo)
  assert.equal(again.placed, false)
  assert.equal(one.records.size, 1, 'written once')
})

test('a placed person keeps their halo when the list changes', async () => {
  const one = store()
  const first = await placement(phone, {
    halos: ['realness-1', 'realness-2'],
    ...one
  })
  const after = await placement(phone, {
    halos: ['realness-2', 'realness-1', 'realness-9'],
    ...one
  })
  assert.equal(after.halo, first.halo)
  assert.equal(after.placed, false)
})

test('the same list always picks the same halo, whatever the order', async () => {
  const halos = ['realness-1', 'realness-2', 'realness-3']
  const sorted = await placement(other, { halos, ...store() })
  const shuffled = await placement(other, {
    halos: [...halos].reverse(),
    ...store()
  })
  assert.equal(shuffled.halo, sorted.halo)
  assert.ok(halos.includes(sorted.halo))
  assert.ok(
    halos.some(halo => halo !== sorted.halo),
    'a real pick, not always the first'
  )
})

test('a retired halo, a bad phone, and an empty list are refused', async () => {
  const one = store()
  await placement(phone, { halos: ['realness-1'], ...one })
  await assert.rejects(
    placement(phone, { halos: ['realness-7'], ...one }),
    /realness-1 no longer serves anyone/
  )
  await assert.rejects(
    placement('nope', { halos: ['realness-1'], ...one }),
    /bad phone number/
  )
  await assert.rejects(
    placement(phone, { halos: [], ...one }),
    /no halos are configured/
  )
})

test('reassign moves a placed person, and refuses one with no placement', async () => {
  const one = store()
  await placement(phone, { halos: ['realness-1', 'realness-2'], ...one })
  const moved = await reassign(phone, 'realness-2', one)
  assert.equal(moved.halo, 'realness-2')
  assert.equal(
    read_placement(one.records.get(placement_key(phone))).halo,
    'realness-2'
  )
  await assert.rejects(
    reassign('+14155550199', 'realness-2', one),
    /no placement to move/
  )
})

test('the gate reaches the placed halo at its own address', async () => {
  const store_one = store()
  const halo_for = placed_halos({
    addresses: {
      'realness-1': { host: '10.0.0.1', port: 8081, api_port: 8080 },
      'realness-2': { host: '10.0.0.2', port: 8081, api_port: 8080 }
    },
    ...store_one
  })
  const first = await halo_for(phone)
  assert.deepEqual(first, await halo_for(phone))
  assert.ok(['10.0.0.1', '10.0.0.2'].includes(first.host))
  assert.equal(first.api_port, 8080)
  assert.throws(
    () => placed_halos({ addresses: { 'realness-1': { host: 'h' } } }),
    /bad address for realness-1/
  )
})

test('hs-n4: releasing a halo drops only its own placements', async () => {
  const records = new Map()
  const one = store(records)
  await placement(phone, { halos: ['realness-1'], ...one })
  await placement(other, { halos: ['realness-1'], ...one })
  records.set(
    placement_key('+14155550188'),
    placement_html({ phone: '+14155550188', halo: 'realness-2', placed: 'x' })
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
    release_placements('Not A Halo', {
      list: async () => [],
      read: one.read,
      remove: async () => {}
    }),
    /bad halo name/
  )
})
