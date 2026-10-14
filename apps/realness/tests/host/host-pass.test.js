import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  issue_host_pass,
  verify_host_pass
} from '#root/src/sign-on/node/host-pass.js'
import { issue_host_pass as sync_issue_host_pass } from '#root/src/sign-on/node/host-pass.js'

const secret = 'test-secret-123456789012345678901234567890'
const phone = '+14155550100'
const now = 1_800_000_000_000

test('a pass a host client mints verifies', () => {
  const pass = issue_host_pass({ phone }, secret, now)
  assert.deepEqual(verify_host_pass(pass, secret, now), { phone })
})

test('the host and sync issuers agree byte for byte', () => {
  assert.equal(
    issue_host_pass({ phone }, secret, now),
    sync_issue_host_pass({ phone }, secret, now)
  )
})

test('the issuer refuses what the verifier refuses', () => {
  assert.throws(
    () => issue_host_pass({ phone: '4155550100' }, secret, now),
    /verified phone/
  )
  assert.throws(() => issue_host_pass({}, secret, now), /verified phone/)
  assert.throws(
    () => issue_host_pass({ phone }, 'short', now),
    /at least 32 bytes/
  )

  const pass = issue_host_pass({ phone }, secret, now)
  assert.throws(
    () =>
      verify_host_pass(pass, 'another-secret-123456789012345678901234', now),
    /bad host pass/
  )
  assert.throws(
    () => verify_host_pass(pass.replace(/.$/, 'x'), secret, now),
    /bad host pass/
  )
  assert.throws(() => verify_host_pass(pass, secret, now + 301_000), /expired/)
})
