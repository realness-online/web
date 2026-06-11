import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { use_posters } from '@/use/poster'
import { as_directory } from '@/persistence/Directory'

vi.mock('@/persistence/Directory')

// Helper to test composables in proper Vue context
function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return result
}

describe('use_posters - archive loading', () => {
  let posters_composable

  beforeEach(() => {
    vi.clearAllMocks()
    posters_composable = with_setup(use_posters)
  })

  describe('poster_shown with archived posters', () => {
    it('loads archived posters with correct ID format including archive_id', async () => {
      const author_id = '/+16282281824'
      const archive_id = 1737178477987

      // Mock the root directory to show there's an archive
      vi.mocked(as_directory).mockImplementation(async path => {
        if (path === `${author_id}/posters`) {
          return {
            id: `${author_id}/posters/`,
            items: [1800000000000], // Recent poster in root
            archive: [archive_id], // Archive directory exists
            types: []
          }
        }
        if (path === `${author_id}/posters/`) {
          return {
            id: `${author_id}/posters/`,
            items: [1800000000000],
            archive: [archive_id],
            types: []
          }
        }
        if (path === `${author_id}/posters/${archive_id}/`) {
          return {
            id: `${author_id}/posters/${archive_id}/`,
            items: [1774048681125], // Poster timestamp in archive
            archive: [],
            types: []
          }
        }
        return null
      })

      // First call for_person to populate posters and authors
      await posters_composable.for_person({ id: author_id })

      // Simulate showing the oldest poster (which triggers archive loading)
      const oldest_poster = {
        id: `${author_id}/posters/1800000000000`,
        type: 'posters'
      }

      await posters_composable.poster_shown(oldest_poster)

      // Verify the archived poster has the correct ID format
      const archived_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${archive_id}/1774048681125`
      )

      expect(archived_poster).toBeDefined()
      expect(archived_poster.id).toBe(
        `${author_id}/posters/${archive_id}/1774048681125`
      )
    })

    it('constructs archive poster IDs with all path segments', async () => {
      const author_id = '/+16282281824'
      const archive_id = 1737178477987
      const poster_timestamp = 1774048681125

      // Mock directories
      vi.mocked(as_directory).mockImplementation(async path => {
        if (
          path === `${author_id}/posters` ||
          path === `${author_id}/posters/`
        ) {
          return {
            id: `${author_id}/posters/`,
            items: [1800000000000], // Recent poster
            archive: [archive_id],
            types: []
          }
        }
        if (path === `${author_id}/posters/${archive_id}/`) {
          return {
            id: `${author_id}/posters/${archive_id}/`,
            items: [poster_timestamp],
            archive: [],
            types: []
          }
        }
        return null
      })

      // First call for_person to populate posters and authors
      await posters_composable.for_person({ id: author_id })

      const oldest_poster = {
        id: `${author_id}/posters/1800000000000`,
        type: 'posters'
      }

      await posters_composable.poster_shown(oldest_poster)

      // The archived poster ID should have 4 path segments:
      // /author/type/archive_timestamp/poster_timestamp
      const archived_poster = posters_composable.posters.value.find(p =>
        p.id.includes(String(archive_id))
      )
      const path_parts = archived_poster.id.split('/').filter(Boolean)

      expect(path_parts).toHaveLength(4) // [author, posters, archive_id, timestamp]
      expect(path_parts[0]).toBe('+16282281824')
      expect(path_parts[1]).toBe('posters')
      expect(path_parts[2]).toBe(String(archive_id))
      expect(path_parts[3]).toBe(String(poster_timestamp))
    })

    it('differentiates between archived and non-archived poster IDs', async () => {
      const author_id = '/+16282281824'
      const archive_id = 1737178477987

      // Recent poster in root directory
      const recent_timestamp = 1800000000000
      // Old poster in archive
      const archived_timestamp = 1774048681125

      vi.mocked(as_directory).mockImplementation(async path => {
        if (
          path === `${author_id}/posters` ||
          path === `${author_id}/posters/`
        ) {
          return {
            id: `${author_id}/posters/`,
            items: [recent_timestamp],
            archive: [archive_id],
            types: []
          }
        }
        if (path === `${author_id}/posters/${archive_id}/`) {
          return {
            id: `${author_id}/posters/${archive_id}/`,
            items: [archived_timestamp],
            archive: [],
            types: []
          }
        }
        return null
      })

      await posters_composable.for_person({ id: author_id })

      const oldest_poster = {
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      }

      await posters_composable.poster_shown(oldest_poster)

      // Check that we have both types of posters
      const recent_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${recent_timestamp}`
      )
      const archived_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${archive_id}/${archived_timestamp}`
      )

      // Recent poster should have 3 path segments
      expect(recent_poster.id.split('/').filter(Boolean)).toHaveLength(3)

      // Archived poster should have 4 path segments
      expect(archived_poster.id.split('/').filter(Boolean)).toHaveLength(4)
    })
  })
})
