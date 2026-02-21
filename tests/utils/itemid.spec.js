import { describe, it, expect, vi } from 'vitest'
import {
  as_filename,
  as_archive,
  is_itemid,
  as_poster_id,
  as_layer_name,
  as_layer_id,
  load_from_cache,
  load_from_network
} from '@/utils/itemid'
import { get } from 'idb-keyval'
vi.mock('idb-keyval')
vi.mock('@/utils/serverless', () => ({
  url: vi.fn().mockResolvedValue('https://example.com/file.html.gz'),
  current_user: { value: null },
  directory: vi.fn(),
  me: { value: undefined },
  app: { value: undefined },
  auth: { value: undefined },
  storage: { value: undefined }
}))
const directory = {
  id: '/+16282281824/posters/index/',
  types: [],
  archive: [
    1575821772081, 1596637795732, 1608304999951, 1616785878248, 1626119663626,
    1638909938110, 1654093031913, 1654379684950, 1662500837925, 1672276991456,
    1682865013400, 1689545625036, 1705888911565, 1712335058767, 1715021054576
  ],
  items: [
    '1720119797893',
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
    it('generates correct path for user index', async () => {
      const result = await as_filename('/+16282281824')
      expect(result).toBe('people/+16282281824/index.html.gz')
    })

    it('generates correct path for statements', async () => {
      const result = await as_filename('/+16282281824/statements')
      expect(result).toBe('people/+16282281824/statements/index.html.gz')
    })

    it('generates correct path for brand new poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1737178477999')
      expect(result).toBe('people/+16282281824/posters/1737178477999.html.gz')
    })

    it('generates correct path for oldest poster in the root directory', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/posters/1720119797893')
      expect(result).toBe('people/+16282281824/posters/1720119797893.html.gz')
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

    it('generates correct path for shadow layer with suffix', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/shadows/1737178477987')
      expect(result).toBe(
        'people/+16282281824/posters/1737178477987-shadows.html.gz'
      )
    })

    it('generates correct path for sediment layer with suffix', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/sediment/1737178477987')
      expect(result).toBe(
        'people/+16282281824/posters/1737178477987-sediment.html.gz'
      )
    })

    it('generates correct path for sand layer with suffix', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/sand/1737178477987')
      expect(result).toBe(
        'people/+16282281824/posters/1737178477987-sand.html.gz'
      )
    })

    it('generates correct path for archived shadow layer with suffix', async () => {
      get.mockResolvedValue(directory)

      const result = await as_filename('/+16282281824/shadows/1715020920519')
      expect(result).toBe(
        'people/+16282281824/posters/1712335058767/1715020920519-shadows.html.gz'
      )
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

  describe('archive path resolution', () => {
    it('returns null for poster in current items', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1737178477999')
      expect(result).toBe(null)
    })

    it('returns correct path for archived poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1715020920519')
      expect(result).toBe(
        'people/+16282281824/posters/1712335058767/1715020920519'
      )
    })

    it('returns correct path for archive folder itself', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1712335058767')
      expect(result).toBe(
        'people/+16282281824/posters/1712335058767/1712335058767'
      )
    })

    it('returns correct path for newest archived poster', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1720060222368')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1720060222368'
      )
    })

    it('returns null for poster older than any archive', async () => {
      get.mockResolvedValue(directory)

      const result = await as_archive('/+16282281824/posters/1000000000000')
      expect(result).toBe(null)
    })
  })

  describe('layer ID conversion', () => {
    it('extracts poster ID from shadow layer ID', () => {
      const result = as_poster_id('/+16282281824/shadows/1737178477987')
      expect(result).toBe('/+16282281824/posters/1737178477987')
    })

    it('extracts poster ID from sediment layer ID', () => {
      const result = as_poster_id('/+16282281824/sediment/1737178477987')
      expect(result).toBe('/+16282281824/posters/1737178477987')
    })

    it('extracts poster ID from sand layer ID', () => {
      const result = as_poster_id('/+16282281824/sand/1737178477987')
      expect(result).toBe('/+16282281824/posters/1737178477987')
    })

    it('returns null for non-layer ID', () => {
      const result = as_poster_id('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })

    it('returns null for invalid ID', () => {
      expect(as_poster_id('')).toBeNull()
      expect(as_poster_id(null)).toBeNull()
      expect(as_poster_id(undefined)).toBeNull()
    })

    it('extracts layer name from shadow layer ID', () => {
      const result = as_layer_name('/+16282281824/shadows/1737178477987')
      expect(result).toBe('shadows')
    })

    it('extracts layer name from sediment layer ID', () => {
      const result = as_layer_name('/+16282281824/sediment/1737178477987')
      expect(result).toBe('sediment')
    })

    it('extracts layer name from sand layer ID', () => {
      const result = as_layer_name('/+16282281824/sand/1737178477987')
      expect(result).toBe('sand')
    })

    it('extracts layer name from rocks layer ID', () => {
      const result = as_layer_name('/+16282281824/rocks/1737178477987')
      expect(result).toBe('rocks')
    })

    it('extracts layer name from boulders layer ID', () => {
      const result = as_layer_name('/+16282281824/boulders/1737178477987')
      expect(result).toBe('boulders')
    })

    it('returns null for non-layer ID', () => {
      const result = as_layer_name('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })

    it('constructs layer ID from poster ID', () => {
      const result = as_layer_id(
        '/+16282281824/posters/1737178477987',
        'shadows'
      )
      expect(result).toBe('/+16282281824/shadows/1737178477987')
    })

    it('constructs sediment layer ID from poster ID', () => {
      const result = as_layer_id(
        '/+16282281824/posters/1737178477987',
        'sediment'
      )
      expect(result).toBe('/+16282281824/sediment/1737178477987')
    })

    it('constructs sand layer ID from poster ID', () => {
      const result = as_layer_id('/+16282281824/posters/1737178477987', 'sand')
      expect(result).toBe('/+16282281824/sand/1737178477987')
    })
  })

  describe('load_from_cache and load_from_network', () => {
    it('returns null item and html when fetch returns 404', async () => {
      get.mockImplementation(key =>
        key === 'sync:index' ? Promise.resolve({}) : Promise.resolve(directory)
      )
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Map([['Content-Encoding', 'identity']]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })

      const result = await load_from_cache(
        /** @type {import('@/types').Id} */ (
          '/+16282281824/shadows/1737178477987'
        )
      )

      expect(result).toEqual({ item: null, html: null })
    })

    it('load_from_network returns null when fetch returns 404', async () => {
      get.mockImplementation(key =>
        key === 'sync:index' ? Promise.resolve({}) : Promise.resolve(directory)
      )
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Map([['Content-Encoding', 'identity']]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })

      const result = await load_from_network(
        /** @type {import('@/types').Id} */ (
          '/+16282281824/shadows/1737178477987'
        )
      )

      expect(result).toBeNull()
    })
  })
})
