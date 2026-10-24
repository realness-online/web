import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  open_pass,
  peek_pass,
  read_pass,
  sign_pass
} from '#root/src/can/pass.js'

const secret = 's'.repeat(32)
const now = Date.parse('2026-10-06T12:00:00Z')
const options = {
  audience: 'realness-test',
  life_s: 60,
  name: 'test pass',
  now
}
const pass = sign_pass(
  { aud: 'realness-test', phone: '+14155550123' },
  secret,
  { life_s: 60, now }
)

it('a pass opens for its audience inside its life', () => {
  assert.deepEqual(open_pass(pass, secret, options), {
    aud: 'realness-test',
    phone: '+14155550123',
    exp: now / 1000 + 60
  })
})

it('another audience, secret, or a tampered body is refused', () => {
  assert.throws(
    () => open_pass(pass, secret, { ...options, audience: 'realness-other' }),
    /expired or invalid test pass/
  )
  assert.throws(() => open_pass(pass, 't'.repeat(32), options), /bad test pass/)
  const [, signature] = pass.split('.')
  const forged = Buffer.from(
    JSON.stringify({
      aud: 'realness-test',
      phone: '+14155550199',
      exp: now / 1000 + 60
    })
  ).toString('base64url')
  assert.throws(
    () => open_pass(`${forged}.${signature}`, secret, options),
    /bad test pass/
  )
  assert.throws(() => open_pass('not a pass', secret, options), /bad test pass/)
})

it('an expired pass, or one claiming a longer life, is refused', () => {
  assert.throws(
    () => open_pass(pass, secret, { ...options, now: now + 61_000 }),
    /expired or invalid/
  )
  const long = sign_pass({ aud: 'realness-test' }, secret, { life_s: 600, now })
  assert.throws(() => open_pass(long, secret, options), /expired or invalid/)
})

it('a short secret signs nothing and opens nothing', () => {
  assert.throws(
    () => sign_pass({ aud: 'realness-test' }, 'short', { life_s: 60, now }),
    /at least 32 bytes/
  )
  assert.throws(
    () => open_pass(pass, 'short', options),
    /test pass secret must be at least 32 bytes/
  )
})

it('read_pass is null where open_pass throws; peek_pass skips the signature', () => {
  assert.equal(read_pass('forged.cookie', secret, options), null)
  assert.equal(read_pass(pass, secret, options).phone, '+14155550123')
  assert.equal(peek_pass(pass).phone, '+14155550123')
})
