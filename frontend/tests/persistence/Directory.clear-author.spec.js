import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { keys, del } from 'idb-keyval'
import { clear_author_dirs } from '@/persistence/Directory'

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
  keys: vi.fn(() => Promise.resolve([]))
}))

vi.mock('@/utils/poster-delete-log', () => ({ poster_delete_log: vi.fn() }))

describe('clear_author_dirs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears cached listings and leaves cached files where they are', async () => {
    // Statements freshness is a hash check, not a blunt purge. If this ever
    // starts deleting plain file keys, someone has fixed a staleness bug the
    // expensive way and every profile edit now re-downloads poster bodies.
    vi.mocked(keys).mockResolvedValue([
      '/+14155550101/posters/',
      '/+14155550101/posters/1737178477987/',
      '/+14155550101/statements',
      '/+14155550101/posters/1737178477987'
    ])

    await clear_author_dirs('/+14155550101')

    expect(del).toHaveBeenCalledWith('/+14155550101/posters/')
    expect(del).toHaveBeenCalledWith('/+14155550101/posters/1737178477987/')
    expect(del).not.toHaveBeenCalledWith('/+14155550101/statements')
    expect(del).not.toHaveBeenCalledWith('/+14155550101/posters/1737178477987')
  })
})
