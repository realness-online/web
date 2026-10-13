import { createHash, createHmac } from 'node:crypto'
import { deflateSync, gunzipSync, gzipSync } from 'node:zlib'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_file, mock_get_files, mock_log_error, mock_log_info, mock_log_warn } =
  vi.hoisted(() => ({
    mock_file: {
      download: vi.fn(),
      getMetadata: vi.fn(),
      save: vi.fn(),
      setMetadata: vi.fn(),
      exists: vi.fn()
    },
    mock_get_files: vi.fn(),
    mock_log_error: vi.fn(),
    mock_log_info: vi.fn(),
    mock_log_warn: vi.fn()
  }))

vi.mock('#utils/firebase.js', () => ({
  bucket: { file: vi.fn(() => mock_file), getFiles: mock_get_files }
}))

vi.mock('#utils/log.js', () => ({
  log_error: mock_log_error,
  log_info: mock_log_info,
  log_warn: mock_log_warn
}))

const { bucket } = await import('#utils/firebase.js')
const { prints_webhook_handler } = await import(
  '#handlers/http/prints-webhook.js'
)

const SECRET = 'whsec_test'
const AUTHOR = '/+14155550142'
const POSTER = `${AUTHOR}/posters/1712000000000`
const poster_html = (extra = '') =>
  `<svg itemscope="" itemid="${POSTER}" viewBox="0 0 1 1"><path itemprop="light" d="M0 0"></path>${extra}</svg>`

const sold_for = amount =>
  `<metadata itemprop="sale" itemscope=""><data itemprop="price" value="${amount}"></data></metadata>`

const fake_res = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn()
})

const signed_request = (event, secret = SECRET) => {
  const raw = Buffer.from(JSON.stringify(event))
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')
  return { rawBody: raw, headers: { 'stripe-signature': `t=${t},v1=${v1}` } }
}

const PAID_AT = 1790044942

const completed = (poster_id = POSTER) => ({
  type: 'checkout.session.completed',
  livemode: true,
  created: PAID_AT,
  data: {
    object: {
      id: 'cs_1',
      amount_total: 500,
      payment_status: 'paid',
      metadata: { poster_id }
    }
  }
})

const saved_html = () => gunzipSync(mock_file.save.mock.calls[0][0]).toString('utf8')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = SECRET
  process.env.PRINTS_AUTHOR = AUTHOR
  mock_file.exists.mockResolvedValue([true])
  mock_get_files.mockResolvedValue([[]])
  mock_file.download.mockResolvedValue([deflateSync(poster_html())])
  mock_file.getMetadata.mockResolvedValue([
    {
      name: `people${POSTER}.html.gz`,
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentEncoding: 'deflate',
      contentDisposition: 'inline',
      contentLanguage: 'en',
      metadata: { hash: 'old', fullLocale: 'en-US' }
    }
  ])
  mock_file.save.mockResolvedValue()
})

describe('#handlers/http/prints-webhook', () => {
  it('rejects an event without a valid Stripe signature', async () => {
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed(), 'whsec_forged'), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mock_file.download).not.toHaveBeenCalled()
  })

  it('accepts a secret stored with a trailing newline', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = `${SECRET}\n`
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(mock_file.save).toHaveBeenCalled()
  })

  it('ignores events other than a completed checkout', async () => {
    const res = fake_res()
    await prints_webhook_handler(
      signed_request({ ...completed(), type: 'checkout.session.expired' }),
      res
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(mock_file.download).not.toHaveBeenCalled()
  })

  it('ignores test-mode events so a test never sells a real poster', async () => {
    const res = fake_res()
    await prints_webhook_handler(
      signed_request({ ...completed(), livemode: false }),
      res
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(mock_file.download).not.toHaveBeenCalled()
  })

  it('records a sale on a poster stored gzip', async () => {
    mock_file.download.mockResolvedValue([gzipSync(poster_html())])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(saved_html()).toContain('itemprop="sale"')
  })

  it('dates the sale when Stripe completed it, so a retry keeps the day', async () => {
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(saved_html()).toContain('datetime="2026-09-22T02:42:22.000Z"')
  })

  it('tags an already sold poster that lacks the sold tag', async () => {
    mock_file.download.mockResolvedValue([deflateSync(poster_html(sold_for(500)))])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(mock_file.save).not.toHaveBeenCalled()
    expect(mock_file.setMetadata).toHaveBeenCalledWith({
      metadata: { sold: 'true' }
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignores posters that are not the prints author\'s', async () => {
    const res = fake_res()
    await prints_webhook_handler(
      signed_request(completed('/+15551234567/posters/1')),
      res
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(mock_file.download).not.toHaveBeenCalled()
  })

  it('ignores a completed checkout that is not paid', async () => {
    const event = completed()
    event.data.object.payment_status = 'unpaid'
    const res = fake_res()
    await prints_webhook_handler(signed_request(event), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(mock_file.download).not.toHaveBeenCalled()
  })
})

describe('#handlers/http/prints-webhook recording', () => {
  it('records an async payment that settles later', async () => {
    const event = completed()
    event.type = 'checkout.session.async_payment_succeeded'
    const res = fake_res()
    await prints_webhook_handler(signed_request(event), res)

    expect(saved_html()).toContain('itemprop="sale"')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('writes the sale into the poster file the app reads', async () => {
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(bucket.file).toHaveBeenCalledWith(
      'people/+14155550142/posters/1712000000000.html.gz'
    )
    const html = saved_html()
    expect(html).toContain(`itemid="${POSTER}"`)
    expect(html).toContain('itemprop="sale"')
    expect(html).toContain('value="cs_1"')

    const [[, { metadata }]] = mock_file.save.mock.calls
    expect(metadata).toEqual({
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentEncoding: 'gzip',
      contentDisposition: 'inline',
      contentLanguage: 'en',
      metadata: {
        fullLocale: 'en-US',
        hash: createHash('sha256').update(html).digest('base64'),
        sold: 'true'
      }
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('reads a poster stored uncompressed', async () => {
    mock_file.download.mockResolvedValue([Buffer.from(poster_html())])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(saved_html()).toContain('itemprop="sale"')
  })

  it('writes the sale into a poster the app has archived', async () => {
    const archived = `people${AUTHOR}/posters/1600000000000/1712000000000.html.gz`
    mock_file.exists.mockResolvedValue([false])
    mock_get_files.mockResolvedValue([[{ name: archived }]])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(mock_get_files).toHaveBeenCalledWith({
      prefix: `people${AUTHOR}/posters/`
    })
    expect(bucket.file).toHaveBeenCalledWith(archived)
    expect(saved_html()).toContain('itemprop="sale"')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('answers 500 when the poster file is nowhere', async () => {
    mock_file.exists.mockResolvedValue([false])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mock_file.save).not.toHaveBeenCalled()
  })

  it('records the $100 edition after the $5 edition of the same poster', async () => {
    mock_file.download.mockResolvedValue([deflateSync(poster_html(sold_for(500)))])
    const event = completed()
    event.data.object.amount_total = 10000
    const res = fake_res()
    await prints_webhook_handler(signed_request(event), res)

    expect(saved_html().match(/itemprop="sale"/g)).toHaveLength(2)
    expect(saved_html()).toContain('value="10000"')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignores a repeated $5 sale for the same poster', async () => {
    mock_file.download.mockResolvedValue([deflateSync(poster_html(sold_for(500)))])
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(mock_file.save).not.toHaveBeenCalled()
    expect(mock_log_warn).toHaveBeenCalledWith(
      'prints webhook: edition or session already recorded',
      expect.objectContaining({ poster_id: POSTER, session_id: 'cs_1' })
    )
  })

  it('records another $500 sale without closing that edition', async () => {
    mock_file.download.mockResolvedValue([deflateSync(poster_html(sold_for(50000)))])
    const event = completed()
    event.data.object.amount_total = 50000
    const res = fake_res()
    await prints_webhook_handler(signed_request(event), res)
    expect(saved_html().match(/itemprop="sale"/g)).toHaveLength(2)
  })

  it('does not record a webhook retry of the same session', async () => {
    mock_file.download.mockResolvedValue([
      deflateSync(poster_html(`<metadata itemprop="sale" itemscope=""><data itemprop="price" value="50000"></data><data itemprop="session" value="cs_1"></data></metadata>`))
    ])
    const event = completed()
    event.data.object.amount_total = 50000
    await prints_webhook_handler(signed_request(event), fake_res())
    expect(mock_file.save).not.toHaveBeenCalled()
  })

  it('answers 500 so Stripe retries when the write fails', async () => {
    mock_file.save.mockRejectedValue(new Error('storage down'))
    const res = fake_res()
    await prints_webhook_handler(signed_request(completed()), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(mock_log_error).toHaveBeenCalledWith(
      'prints webhook: storage write failed',
      expect.any(Error)
    )
  })
})
