import { describe, it, expect, vi, beforeEach } from 'vitest'
import { capabilities_handler } from '#handlers/http/capabilities.js'

const fake_res = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn(),
  json: vi.fn()
})

describe('#handlers/http/capabilities', () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.STRIPE_SECRET_KEY
  })

  it('rejects non-GET methods', () => {
    const res = fake_res()
    capabilities_handler({ method: 'POST' }, res)

    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.send).toHaveBeenCalledWith('Method Not Allowed')
    expect(res.json).not.toHaveBeenCalled()
  })

  it('reports phone_integrity false when Twilio secrets are unset', () => {
    const res = fake_res()
    capabilities_handler({ method: 'GET' }, res)

    expect(res.json).toHaveBeenCalledWith({
      push: true,
      phone_integrity: false,
      prints: false
    })
  })

  it('reports phone_integrity true once both Twilio secrets are set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    const res = fake_res()
    capabilities_handler({ method: 'GET' }, res)

    expect(res.json).toHaveBeenCalledWith({
      push: true,
      phone_integrity: true,
      prints: false
    })
  })

  it('reports prints true once the Stripe secret key is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    const res = fake_res()
    capabilities_handler({ method: 'GET' }, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ prints: true })
    )
  })
})
