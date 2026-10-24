import { createHmac } from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  form_encode,
  stripe_request,
  stripe_ready,
  verify_signature
} from '#utils/stripe.js'

const json_response = (data, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data
})

describe('#utils/stripe', () => {
  describe('form_encode', () => {
    it('flattens nested objects and arrays into bracketed keys', () => {
      const encoded = form_encode({
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { unit_amount: 500 } }],
        metadata: { poster_id: '/+1/posters/2' }
      })
      expect(encoded.get('mode')).toBe('payment')
      expect(encoded.get('line_items[0][quantity]')).toBe('1')
      expect(encoded.get('line_items[0][price_data][unit_amount]')).toBe('500')
      expect(encoded.get('metadata[poster_id]')).toBe('/+1/posters/2')
    })

    it('skips undefined and null values', () => {
      const encoded = form_encode({ a: undefined, b: null, c: 0 })
      expect([...encoded.keys()]).toEqual(['c'])
    })
  })

  describe('stripe_ready', () => {
    afterEach(() => {
      delete process.env.STRIPE_SECRET_KEY
    })

    it('is false without a key and true with one', () => {
      expect(stripe_ready()).toBe(false)
      process.env.STRIPE_SECRET_KEY = 'sk_test_x'
      expect(stripe_ready()).toBe(true)
    })
  })

  describe('verify_signature', () => {
    const secret = 'whsec_test'
    const now = 1712000000
    const body = Buffer.from('{"type":"checkout.session.completed"}')
    const sign = (t, payload = body, key = secret) =>
      `t=${t},v1=${createHmac('sha256', key).update(`${t}.${payload}`).digest('hex')}`

    it('accepts a body signed with the endpoint secret', () => {
      expect(verify_signature(body, sign(now), secret, now)).toBe(true)
    })

    it('accepts any matching v1 while secrets roll', () => {
      const header = `t=${now},v1=${'0'.repeat(64)},${sign(now).split(',')[1]}`
      expect(verify_signature(body, header, secret, now)).toBe(true)
    })

    it('rejects a changed body', () => {
      const forged = Buffer.from('{"type":"checkout.session.completed","x":1}')
      expect(verify_signature(forged, sign(now), secret, now)).toBe(false)
    })

    it('rejects a different secret', () => {
      expect(verify_signature(body, sign(now, body, 'whsec_other'), secret, now)).toBe(false)
    })

    it('rejects a signature older than five minutes', () => {
      expect(verify_signature(body, sign(now - 301), secret, now)).toBe(false)
    })

    it('rejects a missing header, body, or secret', () => {
      expect(verify_signature(body, undefined, secret, now)).toBe(false)
      expect(verify_signature(undefined, sign(now), secret, now)).toBe(false)
      expect(verify_signature(body, sign(now), undefined, now)).toBe(false)
    })
  })

  describe('stripe_request', () => {
    const fetch_mock = vi.fn()

    beforeEach(() => {
      vi.stubGlobal('fetch', fetch_mock)
      fetch_mock.mockReset()
      process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      delete process.env.STRIPE_SECRET_KEY
    })

    it('POSTs form-encoded params with the bearer key', async () => {
      fetch_mock.mockResolvedValue(json_response({ id: 'cs_1' }))
      const data = await stripe_request('checkout/sessions', {
        method: 'POST',
        params: { mode: 'payment' }
      })

      expect(data).toEqual({ id: 'cs_1' })
      const [[url, init]] = fetch_mock.mock.calls
      expect(url.toString()).toBe('https://api.stripe.com/v1/checkout/sessions')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer sk_test_x')
      expect(init.body).toBe('mode=payment')
    })

    it('puts GET params in the query string with no body', async () => {
      fetch_mock.mockResolvedValue(json_response({ data: [] }))
      await stripe_request('payment_intents/search', {
        params: { query: "status:'succeeded'", limit: 2 }
      })

      const [[url, init]] = fetch_mock.mock.calls
      expect(url.searchParams.get('query')).toBe("status:'succeeded'")
      expect(url.searchParams.get('limit')).toBe('2')
      expect(init.body).toBeUndefined()
    })

    it('asks for an API version that can search', async () => {
      fetch_mock.mockResolvedValue(json_response({ data: [] }))
      await stripe_request('payment_intents/search', {
        params: { query: "status:'succeeded'" }
      })

      const [[, init]] = fetch_mock.mock.calls
      expect(init.headers['Stripe-Version']).toBe('2025-08-27.basil')
    })

    it('throws with the Stripe message on a non-2xx', async () => {
      fetch_mock.mockResolvedValue(
        json_response({ error: { message: 'No such price' } }, false, 400)
      )
      await expect(stripe_request('checkout/sessions')).rejects.toThrow(
        'No such price'
      )
    })
  })
})
