import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_amounts, mock_create, mock_log_error, mock_log_info, mock_file } =
  vi.hoisted(() => ({
    mock_amounts: vi.fn(),
    mock_create: vi.fn(),
    mock_log_error: vi.fn(),
    mock_log_info: vi.fn(),
    mock_file: { exists: vi.fn(), getMetadata: vi.fn() }
  }))

vi.mock('#utils/firebase.js', () => ({
  bucket: { name: 'realness-online.appspot.com', file: vi.fn(() => mock_file) }
}))

vi.mock('#services/prints.js', async importOriginal => ({
  ...(await importOriginal()),
  paid_print_amounts: mock_amounts,
  create_print_checkout: mock_create
}))

vi.mock('#utils/log.js', () => ({
  log_error: mock_log_error,
  log_info: mock_log_info
}))

const { prints_checkout_handler } = await import(
  '#handlers/http/prints-checkout.js'
)

const fake_res = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn(),
  json: vi.fn()
})

const AUTHOR = '/+14155550142'
const POSTER = `${AUTHOR}/posters/1712000000000`
const request = (amount, poster_id = POSTER) => ({
  method: 'POST',
  body: { poster_id, amount }
})

beforeEach(() => {
  vi.clearAllMocks()
  mock_amounts.mockResolvedValue([])
  mock_file.exists.mockResolvedValue([false])
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  process.env.PRINTS_AUTHOR = AUTHOR
})

describe('#handlers/http/prints-checkout', () => {
  it('rejects methods other than GET and POST', async () => {
    const res = fake_res()
    await prints_checkout_handler({ method: 'DELETE' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mock_amounts).not.toHaveBeenCalled()
  })

  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const res = fake_res()
    await prints_checkout_handler({ method: 'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ error: 'Stripe not configured' })
  })

  it('GET lists all three editions and the paid ones for one poster', async () => {
    mock_amounts.mockResolvedValue([500, 50000])
    const res = fake_res()
    await prints_checkout_handler({ method: 'GET', query: { poster_id: POSTER } }, res)
    expect(mock_amounts).toHaveBeenCalledWith(POSTER)
    expect(res.json).toHaveBeenCalledWith({
      amounts: [500, 10000, 50000],
      sold: [500, 50000],
      currency: 'usd'
    })
  })

  it('returns 400 for invalid JSON string bodies', async () => {
    const res = fake_res()
    await prints_checkout_handler({ method: 'POST', body: '{not json' }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON' })
  })

  it('rejects a poster from another author', async () => {
    const res = fake_res()
    await prints_checkout_handler(request(500, '/+15551234567/posters/1'), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Poster is not for sale' })
    expect(mock_amounts).not.toHaveBeenCalled()
  })

  it('rejects a price outside the three editions', async () => {
    const res = fake_res()
    await prints_checkout_handler(request(1), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid print price' })
    expect(mock_create).not.toHaveBeenCalled()
  })

  it('refuses only an already paid scarce edition', async () => {
    mock_amounts.mockResolvedValue([500])
    const res = fake_res()
    await prints_checkout_handler(request(500), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Print edition already sold' })
    expect(mock_create).not.toHaveBeenCalled()
  })

  it('offers $100 on the poster whose $5 edition sold', async () => {
    mock_amounts.mockResolvedValue([500])
    mock_create.mockResolvedValue({ url: 'https://checkout.stripe.com/x', id: 'cs_1' })
    const res = fake_res()
    await prints_checkout_handler({ ...request(10000), headers: { origin: 'http://localhost:5173' } }, res)
    expect(mock_create).toHaveBeenCalledWith({
      poster_id: POSTER,
      amount: 10000,
      origin: 'http://localhost:5173',
      image: null
    })
    expect(res.json).toHaveBeenCalledWith({
      url: 'https://checkout.stripe.com/x', amount: 10000, currency: 'usd'
    })
    expect(mock_log_info).toHaveBeenCalledWith(
      'print checkout created', expect.objectContaining({ poster_id: POSTER, session: 'cs_1' })
    )
  })

  it('continues offering $500 after a $500 sale', async () => {
    mock_amounts.mockResolvedValue([500, 10000, 50000])
    mock_create.mockResolvedValue({ url: 'https://checkout.stripe.com/x', id: 'cs_2' })
    const res = fake_res()
    await prints_checkout_handler(request(50000), res)
    expect(mock_create).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000 }))
  })

  it('carries the print picture when a preview exists', async () => {
    mock_file.exists.mockResolvedValue([true])
    mock_file.getMetadata.mockResolvedValue([
      { metadata: { firebaseStorageDownloadTokens: 'tok-1' } }
    ])
    mock_create.mockResolvedValue({ url: 'https://checkout.stripe.com/x', id: 'cs_1' })
    const res = fake_res()
    await prints_checkout_handler(request(500), res)
    expect(mock_create).toHaveBeenCalledWith({
      poster_id: POSTER,
      amount: 500,
      origin: undefined,
      image:
        'https://firebasestorage.googleapis.com/v0/b/realness-online.appspot.com/o/people%2F%2B14155550142%2Fposters%2F1712000000000.png?alt=media&token=tok-1'
    })
  })

  it('sells without a picture when the preview cannot be read', async () => {
    mock_file.exists.mockRejectedValue(new Error('storage down'))
    mock_create.mockResolvedValue({ url: 'https://checkout.stripe.com/x', id: 'cs_1' })
    const res = fake_res()
    await prints_checkout_handler(request(500), res)
    expect(mock_create).toHaveBeenCalledWith(
      expect.objectContaining({ poster_id: POSTER, image: null })
    )
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://checkout.stripe.com/x' })
    )
  })

  it('returns 502 and logs when Stripe fails', async () => {
    mock_amounts.mockRejectedValue(new Error('rate limited'))
    const res = fake_res()
    await prints_checkout_handler({ method: 'GET', query: { poster_id: POSTER } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: 'Checkout unavailable' })
    expect(mock_log_error).toHaveBeenCalledWith('print checkout failed', expect.any(Error))
  })
})
