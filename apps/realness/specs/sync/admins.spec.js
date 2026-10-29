import assert from 'node:assert/strict'
import { it } from 'node:test'
import { admins, read_admins } from '../../src/sync/admins.js'

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
    { get: async () => (reads++, page) },
    { now: () => clock }
  )
  assert.equal(await list.has('+14156667777'), false)
  page = { body: Buffer.from('<a href="tel:+14156667777">Scott</a>') }
  assert.equal(await list.has('+14156667777'), false)
  clock = 30_000
  assert.equal(await list.has('+14156667777'), true)
  assert.equal(reads, 2)
})
