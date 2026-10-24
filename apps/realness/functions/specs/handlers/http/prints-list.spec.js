import { deflateSync } from 'node:zlib'
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
    getFiles: vi.fn(({ prefix } = {}) =>
      Promise.resolve([
        mock_objects.filter(
          object => !prefix || object.name.startsWith(prefix)
        )
      ])
    )
  }
}))
vi.mock('#utils/log.js', () => ({
  log_error: mock_log_error,
  log_info: vi.fn()
}))

const { print_created_stamps, prints_list_handler } = await import(
  '#handlers/http/prints-list.js'
)

const author = '/+14155550142'
const older = 1712000000000
const newer = 1712000000001
const poster_id = stamp => `${author}/posters/${stamp}`
const poster_html = stamp =>
  `<svg itemid="${poster_id(stamp)}"><metadata itemprop="sale" itemscope=""><time itemprop="date" datetime="2026-09-22T02:42:22Z"></time></metadata></svg>`

const response = () => ({
  status: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  json: vi.fn(),
  send: vi.fn()
})

/** A print the bucket holds: a preview PNG, its poster, and a statements file. */
const store_print = (stamp, thought = '') => {
  mock_objects.push({ name: `people${author}/posters/${stamp}.png` })
  mock_store.set(`people${author}/posters/${stamp}.png`, Buffer.from('png'))
  mock_store.set(
    `people${author}/posters/${stamp}.html`,
    deflateSync(poster_html(stamp))
  )
  if (!thought) return
  const statements = `people${author}/statements/index.html`
  if (!mock_objects.some(object => object.name === statements))
    mock_objects.push({ name: statements })
  mock_store.set(
    statements,
    deflateSync(
      `<section itemscope itemid="${author}/statements"><div itemscope itemid="${author}/statements/${stamp + 60000}" itemprop="statements"><p itemprop="statement">${thought}</p></div></section>`
    )
  )
}

const list = async (query = {}) => {
  const res = response()
  await prints_list_handler({ method: 'GET', query }, res)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PRINTS_AUTHOR = author
  mock_store.clear()
  mock_objects.length = 0
})

describe('prints list', () => {
  it('answers the newest prints first with their image, thought, and dates', async () => {
    store_print(older, 'the harbor at first light')
    store_print(newer)

    const res = await list()
    const [result] = res.json.mock.calls
    const [{ prints }] = result
    expect(res.status).not.toHaveBeenCalled()
    expect(prints.map(print => print.id)).toEqual([
      String(newer),
      String(older)
    ])
    expect(prints[0].image).toContain('token=abc')
    expect(prints[1].thought).toBe('the harbor at first light')
    expect(prints[0].dates).toEqual(['2026-09-22T02:42:22Z'])
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60')
  })

  it('reads the statement history once for the whole list', async () => {
    store_print(older, 'the harbor at first light')
    store_print(newer)
    const { bucket } = await import('#utils/firebase.js')

    await list()

    const statement_reads = bucket.file.mock.calls.filter(([name]) =>
      String(name).includes('/statements/')
    )
    expect(statement_reads).toHaveLength(1)
  })

  it('counts only posters with a preview PNG as prints', async () => {
    store_print(newer)
    mock_objects.push({ name: `people${author}/posters/${older}.html` })
    mock_store.set(
      `people${author}/posters/${older}.html`,
      deflateSync(poster_html(older))
    )

    expect(await print_created_stamps(author)).toEqual([String(newer)])
  })

  it('reads the created stamps out of a listing with other files in it', async () => {
    mock_objects.push(
      { name: `people${author}/posters/index.html` },
      { name: 'people/+15551234567/posters/1712000000002.png' },
      { name: `people${author}/statements/index.html` }
    )
    store_print(newer)

    expect(await print_created_stamps(author)).toEqual([String(newer)])
  })

  it('holds back the list when the storage read fails', async () => {
    const { bucket } = await import('#utils/firebase.js')
    bucket.getFiles.mockRejectedValueOnce(new Error('offline'))

    const res = await list()
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: 'Prints unavailable' })
    expect(mock_log_error).toHaveBeenCalled()
  })

  it('caps how many prints one answer carries', async () => {
    for (let index = 0; index < 5; index++) store_print(newer + index)

    const [result] = (await list({ limit: '2' })).json.mock.calls
    const [{ prints }] = result
    expect(prints).toHaveLength(2)
    expect(prints[0].id).toBe(String(newer + 4))
  })

  it('refuses anything but a read', async () => {
    const res = response()
    await prints_list_handler({ method: 'POST', query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('answers 404 when no author is configured', async () => {
    delete process.env.PRINTS_AUTHOR
    const res = await list()
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
