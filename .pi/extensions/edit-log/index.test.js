import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notify } from './index.js'

test('notify tells the person through a live ctx', () => {
  const told = []
  notify({ ui: { notify: (...args) => told.push(args) } }, 'edit-log: nope')
  assert.deepEqual(told, [['edit-log: nope', 'warning']])
})

test('notify does not throw when the ctx went stale', () => {
  const stale = {
    get ui() {
      throw new Error('This extension ctx is stale after session replacement')
    }
  }
  assert.doesNotThrow(() => notify(stale, 'edit-log: nope'))
})
