import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_lookup, mock_log_warn, mock_log_error } = vi.hoisted(() => ({
  mock_lookup: vi.fn(),
  mock_log_warn: vi.fn(),
  mock_log_error: vi.fn()
}))

vi.mock('#services/integrity.js', () => ({
  lookup_phone_integrity: mock_lookup
}))

vi.mock('#utils/log.js', () => ({
  log_warn: mock_log_warn,
  log_error: mock_log_error
}))

const { check_phone_integrity_handler } = await import(
  '#handlers/http/check-phone-integrity.js'
)

const fake_res = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn(),
  json: vi.fn()
})

const VALID_PHONE = '+15551234567'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_ACCOUNT_SID = 'sid'
  process.env.TWILIO_AUTH_TOKEN = 'token'
})

describe('#handlers/http/check-phone-integrity request validation', () => {
  it('rejects non-POST methods', async () => {
    const res = fake_res()
    await check_phone_integrity_handler({ method: 'GET' }, res)

    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.send).toHaveBeenCalledWith('Method Not Allowed')
    expect(mock_lookup).not.toHaveBeenCalled()
  })

  it('returns 503 when Twilio is not configured', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone: VALID_PHONE } },
      res
    )

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ error: 'Twilio not configured' })
    expect(mock_lookup).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON string bodies', async () => {
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: '{not json' },
      res
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON' })
  })

  it('parses a valid JSON string body', async () => {
    mock_lookup.mockResolvedValue({ allowed: true, integrity_data: {} })
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: JSON.stringify({ phone: VALID_PHONE }) },
      res
    )

    expect(mock_lookup).toHaveBeenCalledWith(VALID_PHONE, {
      sid: 'sid',
      token: 'token'
    })
  })

  it('treats a missing body as an empty payload', async () => {
    const res = fake_res()
    await check_phone_integrity_handler({ method: 'POST' }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Phone number is required'
    })
  })

  it('treats a Buffer body as an empty payload rather than an object', async () => {
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: Buffer.from('{"phone":"+15551234567"}') },
      res
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Phone number is required'
    })
    expect(mock_lookup).not.toHaveBeenCalled()
  })

  it('returns 400 when phone is missing', async () => {
    const res = fake_res()
    await check_phone_integrity_handler({ method: 'POST', body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Phone number is required'
    })
  })

  it('returns 400 when phone is not a string', async () => {
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone: 5551234567 } },
      res
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Phone number is required'
    })
  })

  it.each([
    ['missing +', '15551234567'],
    ['leading zero', '+05551234567'],
    ['too long', '+1234567890123456'],
    ['contains letters', '+1555abc4567'],
    ['just a plus', '+']
  ])('returns 400 for a non-E.164 phone (%s)', async (_label, phone) => {
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone } },
      res
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Phone number must be E.164 format'
    })
    expect(mock_lookup).not.toHaveBeenCalled()
  })
})

describe('#handlers/http/check-phone-integrity lookup outcomes', () => {
  it('returns the allowed result without warning', async () => {
    mock_lookup.mockResolvedValue({
      allowed: true,
      integrity_data: { type: 'mobile', carrier_name: 'Verizon' }
    })
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone: VALID_PHONE } },
      res
    )

    expect(res.json).toHaveBeenCalledWith({
      allowed: true,
      integrity_data: { type: 'mobile', carrier_name: 'Verizon' }
    })
    expect(mock_log_warn).not.toHaveBeenCalled()
  })

  it('logs a warning and returns the denied result', async () => {
    mock_lookup.mockResolvedValue({
      allowed: false,
      integrity_data: { type: 'voip', carrier_name: 'Bandwidth' }
    })
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone: VALID_PHONE } },
      res
    )

    expect(mock_log_warn).toHaveBeenCalledWith('integrity sign-in denied', {
      type: 'voip',
      carrier_name: 'Bandwidth'
    })
    expect(res.json).toHaveBeenCalledWith({
      allowed: false,
      integrity_data: { type: 'voip', carrier_name: 'Bandwidth' }
    })
  })

  it('returns 502 when the lookup throws', async () => {
    const boom = new Error('Twilio unavailable')
    mock_lookup.mockRejectedValue(boom)
    const res = fake_res()
    await check_phone_integrity_handler(
      { method: 'POST', body: { phone: VALID_PHONE } },
      res
    )

    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: 'Lookup failed' })
    expect(mock_log_error).toHaveBeenCalledWith('integrity lookup failed', boom)
  })
})
