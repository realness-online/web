import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_stripe_request } = vi.hoisted(() => ({
  mock_stripe_request: vi.fn()
}))

vi.mock('#utils/stripe.js', () => ({
  stripe_request: mock_stripe_request
}))

const {
  is_print_poster,
  paid_print_amounts,
  paid_print_sessions,
  return_origin,
  create_print_checkout
} = await import('#services/prints.js')

const AUTHOR = '/+14155550142'
const POSTER = `${AUTHOR}/posters/1712000000000`

beforeEach(() => {
  mock_stripe_request.mockReset()
})

describe('#services/prints', () => {
  describe('is_print_poster', () => {
    it('accepts a poster under the prints author', () => {
      expect(is_print_poster(POSTER, AUTHOR)).toBe(true)
    })

    it('rejects other authors, other types, and garbage', () => {
      expect(is_print_poster('/+15551234567/posters/1', AUTHOR)).toBe(false)
      expect(is_print_poster(`${AUTHOR}/statements/1`, AUTHOR)).toBe(false)
      expect(is_print_poster(`${AUTHOR}/posters/not-a-number`, AUTHOR)).toBe(false)
      expect(is_print_poster(`${AUTHOR}/posters/1/../2`, AUTHOR)).toBe(false)
      expect(is_print_poster(undefined, AUTHOR)).toBe(false)
    })

    it('rejects everything when no author is configured', () => {
      expect(is_print_poster(POSTER, undefined)).toBe(false)
    })
  })

  describe('paid_print_amounts', () => {
    it('returns sold editions for this poster only', async () => {
      mock_stripe_request.mockResolvedValue({ data: [{ amount: 500 }] })
      expect(await paid_print_amounts(POSTER)).toEqual([500])

      const [[path, options]] = mock_stripe_request.mock.calls
      expect(path).toBe('payment_intents/search')
      expect(options.params.query).toContain("status:'succeeded'")
      expect(options.params.query).toContain("metadata['realness_product']:'print'")
      expect(options.params.query).toContain(`metadata['poster_id']:'${POSTER}'`)
    })

    it('pages past repeat $500 sales to find scarce editions', async () => {
      mock_stripe_request
        .mockResolvedValueOnce({ data: [{ amount: 50000 }], next_page: 'page_2' })
        .mockResolvedValueOnce({ data: [{ amount: 500 }, { amount: 10000 }] })
      expect(await paid_print_amounts(POSTER)).toEqual([500, 10000, 50000])
      expect(mock_stripe_request.mock.calls[1][1].params.page).toBe('page_2')
    })
  })

  describe('return_origin', () => {
    it('keeps realness origins and falls back to production', () => {
      expect(return_origin('https://realness.online')).toBe('https://realness.online')
      expect(return_origin('https://realness.local:5173')).toBe('https://realness.local:5173')
      expect(return_origin('http://localhost:5173')).toBe('http://localhost:5173')
      expect(return_origin('https://evil.example')).toBe('https://realness.online')
      expect(return_origin(undefined)).toBe('https://realness.online')
    })
  })

  describe('create_print_checkout', () => {
    it('opens a one-time payment session carrying the poster id twice', async () => {
      mock_stripe_request.mockResolvedValue({
        id: 'cs_1',
        url: 'https://checkout.stripe.com/c/pay/cs_1'
      })

      const result = await create_print_checkout({
        poster_id: POSTER,
        amount: 500,
        origin: 'http://localhost:5173'
      })

      expect(result).toEqual({
        id: 'cs_1',
        url: 'https://checkout.stripe.com/c/pay/cs_1'
      })
      const [[path, options]] = mock_stripe_request.mock.calls
      expect(path).toBe('checkout/sessions')
      expect(options.method).toBe('POST')
      const { params } = options
      expect(params.mode).toBe('payment')
      expect(params.line_items[0].price_data.unit_amount).toBe(500)
      expect(params.line_items[0].price_data.currency).toBe('usd')
      expect(params.line_items[0].price_data.product_data).toEqual({
        name: 'Realness hand-finished print'
      })
      expect(params.metadata).toEqual({
        poster_id: POSTER,
        realness_product: 'print'
      })
      expect(params.payment_intent_data.metadata).toEqual(params.metadata)
      expect(params.shipping_address_collection.allowed_countries).toEqual(['US'])
      expect(params.success_url).toBe(
        'http://localhost:5173/prints?session_id={CHECKOUT_SESSION_ID}'
      )
      expect(params.cancel_url).toBe('http://localhost:5173/prints')
    })

    it('puts the preview picture on the line item when there is one', async () => {
      mock_stripe_request.mockResolvedValue({
        id: 'cs_2',
        url: 'https://checkout.stripe.com/c/pay/cs_2'
      })
      const image =
        'https://firebasestorage.googleapis.com/v0/b/b/o/x.png?alt=media&token=t'

      await create_print_checkout({ poster_id: POSTER, amount: 500, image })

      const [[, options]] = mock_stripe_request.mock.calls
      expect(
        options.params.line_items[0].price_data.product_data.images
      ).toEqual([image])
    })
  })
})

describe('#services/prints paid_print_sessions', () => {
  const session = (id, extra = {}) => ({
    id,
    created: 1790044800,
    amount_total: 500,
    payment_status: 'paid',
    metadata: { realness_product: 'print', poster_id: POSTER },
    payment_intent: { created: 1790044941 },
    ...extra
  })

  it('pages through completed sessions and keeps paid prints', async () => {
    mock_stripe_request
      .mockResolvedValueOnce({
        has_more: true,
        data: [
          session('cs_1'),
          session('cs_sponsor', { metadata: { realness_product: 'sponsor' } }),
          session('cs_unpaid', { payment_status: 'unpaid' })
        ]
      })
      .mockResolvedValueOnce({ has_more: false, data: [session('cs_2')] })

    const sales = await paid_print_sessions()

    expect(sales).toEqual([
      {
        poster_id: POSTER,
        amount: 500,
        session_id: 'cs_1',
        date: '2026-09-22T02:42:21.000Z'
      },
      expect.objectContaining({ session_id: 'cs_2' })
    ])
    const [[path, first], [, second]] = mock_stripe_request.mock.calls
    expect(path).toBe('checkout/sessions')
    expect(first.params).toMatchObject({
      status: 'complete',
      expand: ['data.payment_intent']
    })
    expect(second.params.starting_after).toBe('cs_unpaid')
  })

  it('dates a sale by its session when the payment is missing', async () => {
    mock_stripe_request.mockResolvedValue({
      has_more: false,
      data: [session('cs_1', { payment_intent: null })]
    })
    const [sale] = await paid_print_sessions()
    expect(sale.date).toBe('2026-09-22T02:40:00.000Z')
  })
})
