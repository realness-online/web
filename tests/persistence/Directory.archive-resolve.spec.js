import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  as_archive,
  lookup_archive,
  remember_archive_locations,
  load_directory_from_network
} from '@/persistence/Directory'
import { DOES_NOT_EXIST } from '@/utils/sync-file'
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

describe('as_archive - finding archived posters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for posters in main directory', async () => {
    const poster_id = '/+16282281824/posters/1800000000000'

    // Mock the main directory
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === '/+16282281824/posters/') {
        return {
          id: '/+16282281824/posters/',
          items: [1800000000000, 1790000000000],
          archive: [1737178477987]
        }
      }
      return null
    })

    // Mock keys() for build_local_directory
    vi.mocked(idb.keys).mockResolvedValue([])

    const result = await as_archive(poster_id)
    expect(result).toBeNull()
  })

  it('finds poster in correct archive directory by checking each one', async () => {
    const poster_id = '/+16282281824/posters/1774048681125'
    const archive_id = 1737178477987

    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === '/+16282281824/posters/') {
        return {
          id: '/+16282281824/posters/',
          items: [1800000000000, 1790000000000], // Recent posters only
          archive: [archive_id, 1700000000000] // Two archive directories
        }
      }
      if (key === `/+16282281824/posters/${archive_id}/`) {
        return {
          id: `/+16282281824/posters/${archive_id}/`,
          items: [1774048681125, 1760000000000], // Our poster is here!
          archive: []
        }
      }
      return null
    })

    // Mock keys() for build_local_directory
    vi.mocked(idb.keys).mockResolvedValue([])

    const result = await as_archive(poster_id)

    // Should return the path to the archived poster
    expect(result).toBe(
      `people/+16282281824/posters/${archive_id}/1774048681125`
    )
  })

  it('checks multiple archive directories to find the poster', async () => {
    const poster_id = '/+16282281824/posters/1750000000000'
    const correct_archive_id = 1737178477987
    const wrong_archive_id = 1700000000000

    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === '/+16282281824/posters/') {
        return {
          id: '/+16282281824/posters/',
          items: [1800000000000],
          archive: [correct_archive_id, wrong_archive_id]
        }
      }
      if (key === `/+16282281824/posters/${correct_archive_id}/`) {
        return {
          id: `/+16282281824/posters/${correct_archive_id}/`,
          items: [1774048681125], // Not our poster
          archive: []
        }
      }
      if (key === `/+16282281824/posters/${wrong_archive_id}/`) {
        return {
          id: `/+16282281824/posters/${wrong_archive_id}/`,
          items: [1750000000000], // Our poster is here!
          archive: []
        }
      }
      return null
    })

    // Mock keys() for build_local_directory
    vi.mocked(idb.keys).mockResolvedValue([])

    const result = await as_archive(poster_id)

    expect(result).toBe(
      `people/+16282281824/posters/${wrong_archive_id}/1750000000000`
    )
  })

  it('returns null when poster is not found in any archive', async () => {
    const poster_id = '/+16282281824/posters/9999999999999'

    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === '/+16282281824/posters/') {
        return {
          id: '/+16282281824/posters/',
          items: [1800000000000],
          archive: [1737178477987]
        }
      }
      if (key === '/+16282281824/posters/1737178477987/') {
        return {
          id: '/+16282281824/posters/1737178477987/',
          items: [1774048681125], // Different poster
          archive: []
        }
      }
      return null
    })

    // Mock keys() for build_local_directory
    vi.mocked(idb.keys).mockResolvedValue([])

    const result = await as_archive(poster_id)
    expect(result).toBeNull()
  })

  it('handles real-world archived poster ID', async () => {
    // This is the actual poster ID from the screenshot
    const poster_id = '/+16282281824/posters/1774048681125'
    const archive_id = 1737178477987

    // Use implementation-based mocking to handle multiple get() calls
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === '/+16282281824/posters/') {
        return {
          id: '/+16282281824/posters/',
          items: [], // No items in root - all archived
          archive: [archive_id]
        }
      }
      if (key === `/+16282281824/posters/${archive_id}/`) {
        return {
          id: `/+16282281824/posters/${archive_id}/`,
          items: [1774048681125],
          archive: []
        }
      }
      return null
    })

    // Mock keys() for build_local_directory
    vi.mocked(idb.keys).mockResolvedValue([])

    const result = await as_archive(poster_id)

    // The path should be: people/USER/TYPE/ARCHIVE_ID/POSTER_ID
    expect(result).toBe(
      `people/+16282281824/posters/${archive_id}/1774048681125`
    )
  })
})

describe('archive location map', () => {
  const author = '/+16282281824'
  const map_key = `${author}/posters/archive-map/`
  const archive_id = 1737178477987
  const created = 1774048681125
  const poster_id = `${author}/posters/${created}`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(idb.keys).mockResolvedValue([])
  })

  it('resolves from the map without scanning directories', async () => {
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === map_key) return { [created]: archive_id }
      return null
    })

    const result = await as_archive(poster_id)

    expect(result).toBe(`people${author}/posters/${archive_id}/${created}`)
    // Map hit means no directory listings were consulted
    expect(idb.get).toHaveBeenCalledTimes(1)
  })

  it('resolves archived poster even when its html is cached locally', async () => {
    // Once an archived poster's html lands in idb under its 3-part id,
    // build_local_directory merges its timestamp into the top-level items —
    // as_archive must not mistake that for "lives in the main directory"
    vi.mocked(idb.keys).mockResolvedValue([poster_id])
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === `${author}/posters/`)
        return {
          id: `${author}/posters/`,
          items: [1800000000000],
          archive: [archive_id]
        }
      if (key === `${author}/posters/${archive_id}/`)
        return {
          id: `${author}/posters/${archive_id}/`,
          items: [created],
          archive: []
        }
      return null
    })

    const result = await as_archive(poster_id)

    expect(result).toBe(`people${author}/posters/${archive_id}/${created}`)
  })

  it('self-heals the map when a scan finds the poster', async () => {
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === `${author}/posters/`)
        return {
          id: `${author}/posters/`,
          items: [1800000000000],
          archive: [archive_id]
        }
      if (key === `${author}/posters/${archive_id}/`)
        return {
          id: `${author}/posters/${archive_id}/`,
          items: [created],
          archive: []
        }
      return null
    })

    await as_archive(poster_id)

    expect(idb.set).toHaveBeenCalledWith(map_key, { [created]: archive_id })
  })

  it('lookup_archive returns null when the map has no entry', async () => {
    vi.mocked(idb.get).mockResolvedValue(null)
    expect(await lookup_archive(poster_id)).toBeNull()
  })

  it('clears DOES_NOT_EXIST sync:index markers for items proven to exist', async () => {
    const other_id = `${author}/posters/1234567890123`
    vi.mocked(idb.get).mockImplementation(async key => {
      if (key === 'sync:index')
        return {
          [poster_id]: { ...DOES_NOT_EXIST },
          [other_id]: { updated: 'date', customMetadata: { hash: 'abc' } }
        }
      return null
    })

    await remember_archive_locations(poster_id, archive_id, [created])

    expect(idb.set).toHaveBeenCalledWith(map_key, { [created]: archive_id })
    expect(idb.set).toHaveBeenCalledWith('sync:index', {
      [other_id]: { updated: 'date', customMetadata: { hash: 'abc' } }
    })
  })

  it('load_directory_from_network records locations for archive directories', async () => {
    vi.mocked(idb.get).mockResolvedValue(null)
    mock_firebase_directory.mockResolvedValue({
      items: [
        { name: `${created}.html.gz` },
        { name: `${created}-shadows.html.gz` }
      ],
      prefixes: []
    })

    await load_directory_from_network(`${author}/posters/${archive_id}/`)

    expect(mock_firebase_directory).toHaveBeenCalledWith(
      `people/+16282281824/posters/${archive_id}/`
    )
    expect(idb.set).toHaveBeenCalledWith(map_key, { [created]: archive_id })
  })
})
