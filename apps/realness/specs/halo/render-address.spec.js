import assert from 'node:assert/strict'
import { it } from 'node:test'
import { DEVTOOLS_PORT, devtools_at } from '../../src/halo/render.js'

it('a leased Chrome keeps its own port', () => {
  assert.equal(devtools_at('127.0.0.1:9223'), '127.0.0.1:9223')
})

it('a bare host uses the default DevTools port', () => {
  assert.equal(devtools_at('10.0.0.5'), `10.0.0.5:${DEVTOOLS_PORT}`)
})
