import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_fetch, mock_phone_numbers } = vi.hoisted(() => {
  const mock_fetch = vi.fn()
  const mock_phone_numbers = vi.fn(() => ({ fetch: mock_fetch }))
  return { mock_fetch, mock_phone_numbers }
})

vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(
    // eslint-disable-next-line prefer-arrow-callback
    function () { // soundness-allow: a constructor cannot be an arrow
      return { lookups: { v2: { phoneNumbers: mock_phone_numbers } } }
    }
  )
}))

const { validate_phone_integrity, lookup_phone_integrity } = await import(
  '#services/integrity.js'
)

describe('#services/integrity', () => {
  describe('validate_phone_integrity', () => {
    it('rejects when line_type_intelligence is missing', () => {
      expect(validate_phone_integrity({})).toBe(false)
    })

    it('rejects non-mobile line types', () => {
      expect(
        validate_phone_integrity({
          line_type_intelligence: { type: 'landline', carrier_name: 'AT&T' }
        })
      ).toBe(false)
    })

    it('accepts a plain mobile carrier', () => {
      expect(
        validate_phone_integrity({
          line_type_intelligence: { type: 'mobile', carrier_name: 'Verizon' }
        })
      ).toBe(true)
    })

    it('rejects a blacklisted VoIP carrier even when typed mobile', () => {
      expect(
        validate_phone_integrity({
          line_type_intelligence: {
            type: 'mobile',
            carrier_name: 'Google (Grand Central) - SVR'
          }
        })
      ).toBe(false)
    })

    it('matches blacklisted carriers case-insensitively', () => {
      expect(
        validate_phone_integrity({
          line_type_intelligence: {
            type: 'mobile',
            carrier_name: 'google (grand central) - svr'
          }
        })
      ).toBe(false)
    })

    it('accepts a mobile carrier with no name', () => {
      expect(
        validate_phone_integrity({
          line_type_intelligence: { type: 'mobile' }
        })
      ).toBe(true)
    })
  })

  describe('lookup_phone_integrity', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('allows a real mobile number', async () => {
      mock_fetch.mockResolvedValue({
        lineTypeIntelligence: {
          type: 'mobile',
          carrierName: 'Verizon',
          mobileCountryCode: '310',
          mobileNetworkCode: '004'
        }
      })

      const result = await lookup_phone_integrity('+15551234567', {
        sid: 'sid',
        token: 'token'
      })

      expect(mock_phone_numbers).toHaveBeenCalledWith('+15551234567')
      expect(mock_fetch).toHaveBeenCalledWith({
        fields: ['line_type_intelligence']
      })
      expect(result).toEqual({
        allowed: true,
        integrity_data: {
          type: 'mobile',
          carrier_name: 'Verizon',
          country_code: '310',
          network_code: '004'
        }
      })
    })

    it('blocks a VoIP number', async () => {
      mock_fetch.mockResolvedValue({
        lineTypeIntelligence: {
          type: 'voip',
          carrierName: 'Bandwidth/13 - Bandwidth.com - SVR'
        }
      })

      const result = await lookup_phone_integrity('+15551234567', {
        sid: 'sid',
        token: 'token'
      })

      expect(result.allowed).toBe(false)
      expect(result.integrity_data.type).toBe('voip')
    })

    it('blocks when Twilio returns no line type intelligence', async () => {
      mock_fetch.mockResolvedValue({ lineTypeIntelligence: null })

      const result = await lookup_phone_integrity('+15551234567', {
        sid: 'sid',
        token: 'token'
      })

      expect(result).toEqual({
        allowed: false,
        integrity_data: {
          type: 'unknown',
          carrier_name: 'unknown',
          country_code: 'unknown',
          network_code: 'unknown'
        }
      })
    })

    it('propagates a Twilio API failure to the caller', async () => {
      mock_fetch.mockRejectedValue(new Error('Twilio unavailable'))

      await expect(
        lookup_phone_integrity('+15551234567', { sid: 'sid', token: 'token' })
      ).rejects.toThrow('Twilio unavailable')
    })
  })
})
