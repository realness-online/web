import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import {
  issue_model_pass,
  verify_model_pass
} from '../../src/proxy/model-pass.js'

const secret = 'model-pass-test-secret-at-least-thirty-two-bytes'
const actor = { phone: '+14155550123', id: 'a-abcdef123456' }
const now = Date.parse('2026-09-27T12:00:00Z')

test('one actor-bound pass identifies its person and expires', () => {
  const pass = issue_model_pass(actor, secret, now)
  assert.deepEqual(verify_model_pass(pass, secret, now + 59000), actor)
  assert.throws(() => verify_model_pass(pass, secret, now + 60000), /expired/)
  assert.throws(
    () =>
      verify_model_pass(pass, 'another-secret-at-least-thirty-two-bytes', now),
    /bad model pass/
  )
})

test('cannot use another audience, malformed claims, or an invalid owner', () => {
  assert.throws(
    () => issue_model_pass({ ...actor, phone: 'not-a-phone' }, secret, now),
    /verified owner/
  )
  assert.throws(
    () => issue_model_pass({ ...actor, id: 'other' }, secret, now),
    /verified owner/
  )
  assert.throws(
    () => issue_model_pass({ ...actor, id: 'p-abcdef123456' }, secret, now),
    /verified owner/
  )
  assert.equal(
    verify_model_pass(
      issue_model_pass({ ...actor, id: 'app-abcdef123456' }, secret, now),
      secret,
      now
    ).id,
    'app-abcdef123456'
  )
  assert.throws(
    () => verify_model_pass('broken', secret, now),
    /bad model pass/
  )
  const body = Buffer.from(
    JSON.stringify({ aud: 'realness-halo', ...actor, exp: now / 1000 + 60 })
  ).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(body)
    .digest('base64url')
  assert.throws(
    () => verify_model_pass(`${body}.${signature}`, secret, now),
    /invalid model pass/
  )
})
