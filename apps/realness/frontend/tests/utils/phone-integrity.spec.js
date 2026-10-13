import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'

const fetch_mock = vi.fn()
const origin = 'https://demo.web.app'

describe('@/utils/phone-integrity', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', fetch_mock)
    vi.stubGlobal('location', { origin })
    fetch_mock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns allowed when the service accepts the number', async () => {
    fetch_mock.mockResolvedValue({
      ok: true,
      json: async () => ({
        allowed: true,
        integrity_data: { type: 'mobile', carrier_name: 'Verizon' }
      })
    })

    const { check_phone_integrity } = await import('@/utils/phone-integrity')
    const result = await check_phone_integrity('+15551234567')

    expect(fetch_mock).toHaveBeenCalledWith(
      `${origin}/check-phone-integrity`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '+15551234567' })
      })
    )
    expect(result?.allowed).toBe(true)
  })

  it('returns denied when the service rejects the number', async () => {
    fetch_mock.mockResolvedValue({
      ok: true,
      json: async () => ({
        allowed: false,
        integrity_data: { type: 'nonFixedVoip', carrier_name: 'TextNow' }
      })
    })

    const { check_phone_integrity } = await import('@/utils/phone-integrity')
    const result = await check_phone_integrity('+15551234567')

    expect(result?.allowed).toBe(false)
  })

  it('returns null when the service is unreachable', async () => {
    fetch_mock.mockResolvedValue({ ok: false, status: 503 })

    const { check_phone_integrity } = await import('@/utils/phone-integrity')
    const result = await check_phone_integrity('+15551234567')

    expect(result).toBeNull()
  })
})
