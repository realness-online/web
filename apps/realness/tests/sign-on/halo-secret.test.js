import assert from 'node:assert/strict'
import test from 'node:test'
import { halo_pass_secret } from '../../src/sign-on/node/halo-secret.js'

test('the halo secret is read only under its halo name', () => {
  assert.equal(halo_pass_secret({ HALO_PASS_SECRET: 'current' }), 'current')
  assert.equal(halo_pass_secret({ HOST_PASS_SECRET: 'old' }), undefined)
  assert.equal(halo_pass_secret({}), undefined)
})
