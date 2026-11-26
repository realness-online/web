import assert from 'node:assert/strict'
import { it } from 'node:test'
import { NETWORK_KEY, admins, read_admins } from '../../src/sync/admins.js'

it('admins are tel: links; anything else is ignored', () => {
  const html =
    '<a href="tel:+14156667777">Scott</a> +14155550123 <a href="tel:12345">bad</a>'
  assert.deepEqual([...read_admins(html)], ['+14156667777'])
})

it('admins are also read from the microdata page, laid out as text', () => {
  const html = `<article itemscope itemtype="https://schema.org/Organization">
<h1 itemprop="name">Realness admins</h1>
<p itemprop="founder" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Scott</span> <span itemprop="telephone">+1 415 666-7777</span></p>
</article>`
  assert.deepEqual([...read_admins(html)], ['+14156667777'])
})

it('a page with no admins grants nobody', () => {
  assert.deepEqual([...read_admins('')], [])
})

it('the list is read at most every 30 seconds; none means no admins', async () => {
  let reads = 0
  let page = null
  let clock = 0
  const list = admins(
    { get: async key => (key === NETWORK_KEY ? (reads++, page) : null) },
    { now: () => clock }
  )
  assert.equal(await list.has('+14156667777'), false)
  page = { body: Buffer.from('<a href="tel:+14156667777">Scott</a>') }
  assert.equal(await list.has('+14156667777'), false)
  clock = 30_000
  assert.equal(await list.has('+14156667777'), true)
  assert.equal(reads, 2)
})

it('n2: every member of the network org passes the admin check', async () => {
  const { members_html } = await import('../../src/can/members.js')
  const page = members_html({
    name: '+realness',
    founder: { name: 'Scott', phone: '+14156667777' },
    members: [{ name: 'Ada', phone: '+14155550123' }]
  })
  const list = admins({
    get: async key => (key === NETWORK_KEY ? { body: Buffer.from(page) } : null)
  })
  assert.equal(await list.has('+14156667777'), true)
  assert.equal(await list.has('+14155550123'), true)
  assert.equal(await list.has('+14155550999'), false)
})
