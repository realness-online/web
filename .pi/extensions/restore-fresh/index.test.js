import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import restore_fresh from './index.js'

test('outside a hosted guest it does nothing', { skip: existsSync('/run/brayness') && 'running in a guest' }, () => {
  const listeners = process.listenerCount('exit')
  assert.equal(restore_fresh({}), undefined)
  assert.equal(process.listenerCount('exit'), listeners)
})
