import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { use_posters } from '@/use/poster'
import {
  as_directory,
  remember_archive_locations,
  load_directory_from_network
} from '@/persistence/Directory'

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
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('poster_shown with archived posters', () => {
    const author_id = '/+16282281824'
    const archive_id = 1737178477987
    const recent_timestamp = 1800000000000
    const archived_timestamp = 1774048681125

    const mock_directories = () => {
      vi.mocked(as_directory).mockImplementation(async path => {
        if (
          path === `${author_id}/posters` ||
          path === `${author_id}/posters/`
        ) {
          return {
            id: `${author_id}/posters/`,
            items: [recent_timestamp], // Recent poster in root
            archive: [archive_id], // Archive directory exists
            types: []
          }
        }
        if (path === `${author_id}/posters/${archive_id}/`) {
          return {
            id: `${author_id}/posters/${archive_id}/`,
            items: [archived_timestamp], // Poster timestamp in archive
            archive: [],
            types: []
          }
        }
        return null
      })
    }

    it('loads archived posters with canonical 3-part itemids', async () => {
      mock_directories()

      // First call for_person to populate posters and authors
      await posters_composable.for_person({ id: author_id })

      // Simulate showing the oldest poster (which triggers archive loading)
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })

      // Identity never includes the archive segment — archive is location only
      const archived_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${archived_timestamp}`
      )
      expect(archived_poster).toBeDefined()

      const four_part = posters_composable.posters.value.find(p =>
        p.id.includes(`/${archive_id}/`)
      )
      expect(four_part).toBeUndefined()
    })

    it('records the archive location instead of encoding it in the id', async () => {
      mock_directories()

      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })

      expect(remember_archive_locations).toHaveBeenCalledWith(
        `${author_id}/posters/${archive_id}/`,
        archive_id,
        [archived_timestamp]
      )
    })

    it('gives archived and non-archived posters the same id shape', async () => {
      mock_directories()

      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })

      const recent_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${recent_timestamp}`
      )
      const archived_poster = posters_composable.posters.value.find(
        p => p.id === `${author_id}/posters/${archived_timestamp}`
      )

      expect(recent_poster.id.split('/').filter(Boolean)).toHaveLength(3)
      expect(archived_poster.id.split('/').filter(Boolean)).toHaveLength(3)
    })

    it('skips when all archives are already viewed', async () => {
      mock_directories()
      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })
      const count_after_first = posters_composable.posters.value.length
      as_directory.mockClear()

      await posters_composable.poster_shown({
        id: `${author_id}/posters/${archived_timestamp}`,
        type: 'posters'
      })

      expect(posters_composable.posters.value).toHaveLength(count_after_first)
    })

    it('refreshes archive list from network when cache is exhausted', async () => {
      const network_archive = 1600000000000
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
        if (path === `${author_id}/posters/${network_archive}/`) {
          return {
            id: `${author_id}/posters/${network_archive}/`,
            items: [1500000000000],
            archive: [],
            types: []
          }
        }
        return null
      })
      vi.mocked(load_directory_from_network).mockResolvedValue({
        id: `${author_id}/posters/`,
        items: [recent_timestamp],
        archive: [archive_id, network_archive],
        types: []
      })

      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })
      // second oldest shown after new posters added — mark viewed includes archive_id
      // trigger again with archive already viewed so cache is exhausted for remaining
      const oldest = posters_composable.posters.value.at(-1)
      await posters_composable.poster_shown(oldest)

      expect(load_directory_from_network).toHaveBeenCalled()
      expect(
        posters_composable.posters.value.some(
          p => p.id === `${author_id}/posters/1500000000000`
        )
      ).toBe(true)
    })

    it('returns empty when archive directory is missing', async () => {
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
        return null
      })

      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })

      expect(posters_composable.posters.value).toHaveLength(1)
    })

    it('handles network refresh failure', async () => {
      vi.mocked(as_directory).mockImplementation(async path => {
        if (
          path === `${author_id}/posters` ||
          path === `${author_id}/posters/`
        ) {
          return {
            id: `${author_id}/posters/`,
            items: [recent_timestamp],
            archive: [],
            types: []
          }
        }
        return null
      })
      vi.mocked(load_directory_from_network).mockRejectedValue(
        new Error('offline')
      )

      await posters_composable.for_person({ id: author_id })
      await posters_composable.poster_shown({
        id: `${author_id}/posters/${recent_timestamp}`,
        type: 'posters'
      })

      expect(console.warn).toHaveBeenCalled()
    })
  })
})
