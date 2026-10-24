import assert from 'node:assert/strict'
import { it } from 'node:test'
import { item_html, read_item, read_items } from '#root/lib/items.js'

const visible = html => html.replace(/<[^>]*>/g, ' ')

it('every value shows as text, and reads back the same', () => {
  const fields = {
    status: 'active',
    credit: '1',
    end: '2026-10-17T21:27:43.533Z',
    call: '0349-phone.html',
    note: 'a "quoted" <b>thing</b> & more'
  }
  const html = item_html('plan', fields, { links: ['call'] })
  for (const value of ['active', '2026-10-17T21:27:43.533Z', '0349-phone.html'])
    assert.ok(visible(html).includes(value), value)
  assert.ok(
    html.includes('<time itemprop="end" datetime="2026-10-17T21:27:43.533Z">')
  )
  assert.ok(html.includes('<a itemprop="call" href="0349-phone.html">'))
  assert.ok(!html.includes('<meta'))
  assert.deepEqual(read_item(html, 'plan'), fields)
})

it('the older all-meta form still reads', () => {
  const old =
    '<article itemscope itemtype="/plan"><meta itemprop="status" content="active"><meta itemprop="note" content="a &quot;b&quot;"></article>\n'
  assert.deepEqual(read_item(old, 'plan'), { status: 'active', note: 'a "b"' })
})

it('rows join into one page and read back in order, old and new mixed', () => {
  const page =
    '<p itemscope itemtype="/usage"><meta itemprop="model" content="a"></p>\n' +
    item_html('usage', { model: 'b' }) +
    item_html('usage', { model: 'c' })
  assert.deepEqual(
    read_items(page, 'usage').map(row => row.model),
    ['a', 'b', 'c']
  )
  assert.equal(read_item(page, 'plan'), null)
})

it('empty values stay present and visible as empty', () => {
  const html = item_html('plan', { customer: '', invoice: undefined })
  assert.deepEqual(read_item(html, 'plan'), { customer: '', invoice: '' })
})

it('trusted extra markup rides inside the item', () => {
  const html = item_html(
    'loop',
    { id: 'x' },
    { extra: '<p itemprop="goal">ship it</p>' }
  )
  assert.deepEqual(read_item(html, 'loop'), { id: 'x', goal: 'ship it' })
})
