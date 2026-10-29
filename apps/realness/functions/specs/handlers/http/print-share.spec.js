import { deflateSync, gzipSync } from 'node:zlib'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_store, mock_objects, mock_log_error } = vi.hoisted(() => ({
  mock_store: new Map(),
  mock_objects: [],
  mock_log_error: vi.fn()
}))

vi.mock('#utils/firebase.js', () => ({
  bucket: {
    name: 'test-bucket',
    file: vi.fn(name => ({
      exists: vi.fn(() => Promise.resolve([mock_store.has(name)])),
      download: vi.fn(() => Promise.resolve([mock_store.get(name)])),
      getMetadata: vi.fn(() =>
        Promise.resolve([
          { metadata: { firebaseStorageDownloadTokens: 'abc' } }
        ])
      )
    })),
    getFiles: vi.fn(() => Promise.resolve([mock_objects]))
  }
}))
vi.mock('#utils/log.js', () => ({
  log_error: mock_log_error,
  log_info: vi.fn()
}))

const { bucket } = await import('#utils/firebase.js')
const { print_share_handler } = await import('#handlers/http/print-share.js')
const { sale_dates } = await import('#services/print-details.js')

const author = '/+14155550142'
const created = 1712000000000
const poster_id = `${author}/posters/${created}`
const poster_html = `<svg itemid="${poster_id}"><metadata itemprop="sale" itemscope=""><time itemprop="date" datetime="2026-09-22T02:42:22Z"></time><data itemprop="session" value="cs_secret">cs_secret</data></metadata></svg>`
const statements_html = (entries = []) =>
  `<section itemscope itemid="${author}/statements">${entries
    .map(
      ({ at, text }) =>
        `<div itemscope itemid="${author}/statements/${at}" itemprop="statements"><p itemprop="statement">${text}</p></div>`
    )
    .join('')}</section>`
const response = () => ({
  status: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  send: vi.fn()
})
const serve = async (path = `/prints/${created}`) => {
  const res = response()
  await print_share_handler({ method: 'GET', path }, res)
  return res
}
/** A statements file the bucket holds: list it, then store its bytes. */
const store_statements = (name, entries) => {
  mock_objects.push({ name })
  mock_store.set(name, deflateSync(statements_html(entries)))
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PRINTS_AUTHOR = author
  mock_store.clear()
  mock_objects.length = 0
  mock_store.set(`people${poster_id}.html`, deflateSync(poster_html))
  mock_store.set(`prints${author}/${created}.jpg`, Buffer.from('jpeg'))
})

describe('print share', () => {
  it('shows sale dates and the print image without exposing payment identifiers', async () => {
    const res = await serve()
    expect(bucket.file).toHaveBeenCalledWith(`people${poster_id}.html`)
    expect(res.status).toHaveBeenCalledWith(200)
    const [[page]] = res.send.mock.calls
    expect(page).toContain(
      '<time datetime="2026-09-22T02:42:22Z">2026-09-22</time>'
    )
    expect(page).toContain(`https://realness.online/prints/${created}`)
    expect(page).toContain('property="og:image"')
    expect(page).toContain('token=abc')
    expect(page).not.toContain('cs_secret')
    expect(page).not.toContain(poster_id)
  })

  it('reads a poster and statements stored gzip', async () => {
    mock_store.set(`people${poster_id}.html`, gzipSync(poster_html))
    mock_objects.push({ name: `people${author}/statements/index.html` })
    mock_store.set(
      `people${author}/statements/index.html`,
      gzipSync(statements_html([{ at: created + 60000, text: 'stored gzip' }]))
    )
    const res = await serve()
    expect(res.status).toHaveBeenCalledWith(200)
    const [[page]] = res.send.mock.calls
    expect(page).toContain('<time datetime="2026-09-22T02:42:22Z">')
    expect(page).toContain('<blockquote><p>stored gzip</p></blockquote>')
  })

  it('shares the thought the print was made with', async () => {
    store_statements(`people${author}/statements/index.html`, [
      { at: created + 60000, text: 'the harbor at first light' },
      { at: created + 40 * 60 * 1000, text: 'an unrelated afternoon' }
    ])
    const res = await serve()
    const [[page]] = res.send.mock.calls
    expect(page).toContain(
      '<blockquote><p>the harbor at first light</p></blockquote>'
    )
    expect(page).toContain('the harbor at first light - ')
    expect(page).not.toContain('an unrelated afternoon')
  })

  it('reads the whole thought across every statements page', async () => {
    store_statements(`people${author}/statements/index.html`, [
      { at: created + 120000, text: 'after' }
    ])
    store_statements(`people${author}/statements/${created - 600000}.html`, [
      { at: created - 60000, text: 'before' },
      { at: created - 960000, text: 'a thought of its own' }
    ])
    const res = await serve()
    const [[page]] = res.send.mock.calls
    expect(page).toContain('<blockquote><p>before after</p></blockquote>')
    expect(page).not.toContain('a thought of its own')
  })

  it('rejects unknown and malformed prints', async () => {
    const res = response()
    await print_share_handler({ method: 'GET', path: '/prints/../x' }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(bucket.file).not.toHaveBeenCalled()
    mock_store.clear()
    expect((await serve()).status).toHaveBeenCalledWith(404)
  })

  it('does not use dates from a different poster', () => {
    expect(() => sale_dates(poster_html, `${author}/posters/1`)).toThrow(
      'Poster ID mismatch'
    )
  })

  it('shows an unsold print without a preview', async () => {
    mock_store.set(
      `people${poster_id}.html`,
      Buffer.from(`<svg itemid="${poster_id}"></svg>`)
    )
    mock_store.delete(`prints${author}/${created}.jpg`)
    const res = await serve()
    expect(res.send.mock.calls[0][0]).toContain('No sales recorded yet.')
    expect(res.send.mock.calls[0][0]).not.toContain('property="og:image"')
  })
})
