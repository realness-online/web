import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  issue_halo_pass,
  verify_halo_pass
} from '#root/src/sign-on/node/halo-pass.js'
import { issue_halo_pass as sync_issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'

const secret = 'test-secret-123456789012345678901234567890'
const phone = '+14155550100'
const now = 1_800_000_000_000

it('a pass a halo client mints verifies', () => {
  const pass = issue_halo_pass({ phone }, secret, now)
  assert.deepEqual(verify_halo_pass(pass, secret, now), { phone })
})

it('the halo and sync issuers agree byte for byte', () => {
  assert.equal(
    issue_halo_pass({ phone }, secret, now),
    sync_issue_halo_pass({ phone }, secret, now)
  )
})

it('the issuer refuses what the verifier refuses', () => {
  assert.throws(
    () => issue_halo_pass({ phone: '4155550100' }, secret, now),
    /verified phone/
  )
  assert.throws(() => issue_halo_pass({}, secret, now), /verified phone/)
  assert.throws(
    () => issue_halo_pass({ phone }, 'short', now),
    /at least 32 bytes/
  )

  const pass = issue_halo_pass({ phone }, secret, now)
  assert.throws(
    () =>
      verify_halo_pass(pass, 'another-secret-123456789012345678901234', now),
    /bad halo pass/
  )
  assert.throws(
    () => verify_halo_pass(pass.replace(/.$/, 'x'), secret, now),
    /bad halo pass/
  )
  assert.throws(() => verify_halo_pass(pass, secret, now + 301_000), /expired/)
})
