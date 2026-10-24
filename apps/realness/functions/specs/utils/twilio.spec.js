import { describe, it, expect, beforeEach } from 'vitest'
import {
  twilio_ready,
  twilio_credentials,
  twilio_secret_bindings
} from '#utils/twilio.js'

describe('#utils/twilio', () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  })

  it('exposes both secrets in the binding array', () => {
    expect(twilio_secret_bindings).toHaveLength(2)
  })

  it('is not ready when neither secret is set', () => {
    expect(twilio_ready()).toBe(false)
  })

  it('is not ready when only one secret is set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid'
    expect(twilio_ready()).toBe(false)
  })

  it('is not ready when a secret is set but blank', () => {
    process.env.TWILIO_ACCOUNT_SID = '   '
    process.env.TWILIO_AUTH_TOKEN = 'token'
    expect(twilio_ready()).toBe(false)
  })

  it('is ready when both secrets are set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    expect(twilio_ready()).toBe(true)
  })

  it('reads credentials from the environment', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    expect(twilio_credentials()).toEqual({ sid: 'sid', token: 'token' })
  })
})
