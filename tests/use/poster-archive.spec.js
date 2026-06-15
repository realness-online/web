import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { use_posters } from '@/use/poster'
import {
  as_directory,
  remember_archive_locations
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
  })
})
