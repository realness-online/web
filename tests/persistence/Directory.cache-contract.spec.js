import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { as_directory } from '@/persistence/Directory'
import * as idb from 'idb-keyval'

vi.mock('idb-keyval')
const mock_firebase_directory = vi.fn()
vi.mock('@/utils/serverless', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    current_user: { value: { uid: 'test-user' } },
    directory: (...args) => mock_firebase_directory(...args)
  }
})

const author = '/+14155551212'
const posters = `${author}/posters/`

/**
 * A cached listing is the whole truth as far as the feed is concerned. Anything
 * that writes this cache owes it every poster the account has, from every
 * device - `sync_posters_directory` learned that the hard way by rebuilding it
 * from local idb alone and stranding posters made elsewhere.
 */
describe('as_directory cache contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    })
  })

  it('never reaches the network while a cache exists', async () => {
    idb.get.mockResolvedValue({ id: posters, items: [1000], archive: [] })
    idb.keys.mockResolvedValue([])

    const directory = await as_directory(posters)

    expect(mock_firebase_directory).not.toHaveBeenCalled()
    expect(directory?.items).toEqual([1000])
  })

  it('serves a truncated cache verbatim, no matter what storage holds', async () => {
    idb.get.mockResolvedValue({ id: posters, items: [1000], archive: [] })
    idb.keys.mockResolvedValue([])
    mock_firebase_directory.mockResolvedValue({
      items: [{ name: '1000.html.gz' }, { name: '2000.html.gz' }],
      prefixes: []
    })

    const directory = await as_directory(posters)

    expect(directory?.items).toEqual([1000])
    expect(mock_firebase_directory).not.toHaveBeenCalled()
  })

  it('reads storage only when nothing is cached', async () => {
    idb.get.mockResolvedValue(null)
    idb.keys.mockResolvedValue([])
    mock_firebase_directory.mockResolvedValue({
      items: [{ name: '1000.html.gz' }, { name: '2000.html.gz' }],
      prefixes: []
    })

    const directory = await as_directory(posters)

    expect(mock_firebase_directory).toHaveBeenCalled()
    expect(directory?.items).toEqual([1000, 2000])
  })
})
