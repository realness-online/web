import { describe, it, expect, vi } from 'vitest'
import { as_filename, as_archive, is_itemid } from '@/utils/itemid'
import { get } from 'idb-keyval'
vi.mock('idb-keyval')
const directory = {
  id: '/+16282281824/posters/index/',
  types: [],
  archive: [
    1575821772081, 1596637795732, 1608304999951, 1616785878248, 1626119663626,
    1638909938110, 1654093031913, 1654379684950, 1662500837925, 1672276991456,
    1682865013400, 1689545625036, 1705888911565, 1712335058767, 1715021054576
  ],
  items: [
    '1720576375018',
    '1721096849781',
    '1721597809425',
    '1721780702433',
    '1724597436118',
    '1726326242435',
    '1726326279054',
    '1726326359095',
    '1727291591758',
    '1727291631464',
    '1728226845895',
    '1728226881031',
    '1729214091636',
    '1729277964198',
    '1729554972962',
    '1729720916169',
    '1729720944738',
    '1731473128003',
    '1732664582144',
    '1732665099181',
    '1735108629305',
    '1737178477987'
  ]
}

const sans_archive_directory = {
  id: '/+16282281824/posters/1715021054576/',
  types: [],
  archive: [],
  items: ['1737178477987']
}

describe('@/utils/itemid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('path generation', () => {
    it('generates correct path for brand new poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1737178477999')
      expect(result).toBe('people/+16282281824/posters/1737178477999.html.gz')
    })

    it('generates correct path for last poster in second to last archive directory', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1715020920519')
      expect(result).toBe(
        'people/+16282281824/posters/1712335058767/1715020920519.html.gz'
      )
    })

    it('generates correct path for last poster in most recent archive directory', async () => {
      get.mockResolvedValue(directory)
      const result = await as_filename('/+16282281824/posters/1720060222368')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1720060222368.html.gz'
      )
    })

    it('generates correct path for first poster in an archive directory', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1712335058767')
      expect(result).toBe(
        'people/+16282281824/posters/1712335058767/1712335058767.html.gz'
      )
    })

    it('generates correct root path for poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1737178477987')
      expect(result).toBe('people/+16282281824/posters/1737178477987.html.gz')
    })

    it('generates correct archive path for archived poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1716520718216')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1716520718216.html.gz'
      )
    })

    it('defaults to root path when no directory exists', async () => {
      get.mockResolvedValue(null)

      const result = await as_filename('/+16282281824/posters/1737178477987')
      expect(result).toBe('people/+16282281824/posters/1737178477987.html.gz')
    })
  })

  describe('archive detection', () => {
    it('returns null for items in main list', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })

    it('returns archive path for first poster in archive', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1715021054576')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1715021054576'
      )
    })

    it('returns null when no archives exist', async () => {
      get.mockResolvedValue(sans_archive_directory)

      const result = await as_archive('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })
  })

  describe('item id validation', () => {
    it('validates correct item ids', () => {
      expect(is_itemid('/+16282281824/events')).toBe(true)
      expect(is_itemid('/+16282281824/statements')).toBe(true)
      expect(is_itemid('/+16282281824/posters/1737178477987')).toBe(true)
      expect(is_itemid('/+16282281824/statements/1737178477987')).toBe(true)
      expect(is_itemid('/+16282281824/events/1737178477987')).toBe(true)
      expect(is_itemid('/+16282281824/relations/1737178477987')).toBe(true)
      expect(is_itemid('/+16282281824/me/1737178477987')).toBe(true)
    })

    it('rejects invalid item ids', () => {
      // Invalid format
      expect(is_itemid('not-an-id')).toBe(false)
      expect(is_itemid('')).toBe(false)
      expect(is_itemid(null)).toBe(false)
      expect(is_itemid(undefined)).toBe(false)

      // Missing leading slash
      expect(is_itemid('+16282281824/posters/1737178477987')).toBe(false)

      // Invalid author (missing plus)
      expect(is_itemid('/16282281824/posters/1737178477987')).toBe(false)

      // Invalid type
      expect(is_itemid('/+16282281824/invalid_type/1737178477987')).toBe(false)

      // Invalid created timestamp (not a number)
      expect(is_itemid('/+16282281824/posters/abc')).toBe(false)
      expect(is_itemid('/+16282281824/posters/123.456')).toBe(false)

      // Wrong number of segments
      expect(is_itemid('/+16282281824/posters')).toBe(false)
      expect(is_itemid('/+16282281824/posters/1737178477987/extra')).toBe(false)
    })

    it('validates ids from test directory', () => {
      // Test with actual IDs from the test directory
      directory.items.forEach(created => {
        const id = `/+16282281824/posters/${created}`
        expect(is_itemid(id)).toBe(true)
      })

      directory.archive.forEach(created => {
        const id = `/+16282281824/posters/${created}`
        expect(is_itemid(id)).toBe(true)
      })
    })
  })
})
