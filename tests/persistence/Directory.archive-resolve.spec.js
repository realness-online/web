import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { as_archive } from '@/persistence/Directory'
import * as idb from 'idb-keyval'

vi.mock('idb-keyval')
vi.mock('@/utils/serverless', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, current_user: { value: { uid: 'test-user' } } }
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
