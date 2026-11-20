import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summary } from '../../prewalk/cold.js'

const item = (at, { cold = 'yes', shape = 'same', write = 40_000 } = {}) =>
  `<article itemscope itemid="/cold-watch/turns/${at.replace(/[^0-9]/g, '')}" itemtype="/cold-watch/turn"><dl><dt>at</dt><dd><span itemprop="at">${at}</span></dd><dt>cold</dt><dd><span itemprop="cold">${cold}</span></dd><dt>shape</dt><dd><span itemprop="shape">${shape}</span></dd><dt>write</dt><dd><span itemprop="write">${write}</span></dd></dl></article>`

const page = (...items) => `<main>${items.join('')}</main>`

test('a cold turn after a changed shape is ours', () => {
  const days = summary(page(item('2026-11-17T10:00:00.000Z', { shape: 'changed' })))
  assert.equal(days['2026-11-17'].changed, 1)
  assert.equal(days['2026-11-17'].same, 0)
})

test('a cold turn after the same shape is the provider', () => {
  const days = summary(page(item('2026-11-17T10:00:00.000Z')))
  assert.equal(days['2026-11-17'].same, 1)
})

test('a warm turn is not a cold turn', () => {
  const days = summary(page(item('2026-11-17T10:00:00.000Z', { cold: 'no' })))
  assert.equal(days['2026-11-17'].written, 0)
})

test('the page is grouped by day and can start late', () => {
  const html = page(
    item('2026-11-16T10:00:00.000Z'),
    item('2026-11-17T10:00:00.000Z'),
    item('2026-11-17T11:00:00.000Z')
  )
  assert.deepEqual(Object.keys(summary(html)).sort(), ['2026-11-16', '2026-11-17'])
  assert.deepEqual(Object.keys(summary(html, '2026-11-17')), ['2026-11-17'])
  assert.equal(summary(html)['2026-11-17'].written, 80_000)
})
