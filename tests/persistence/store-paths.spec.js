import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  keys: vi.fn(async () => [])
}))

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(),
  remove: vi.fn(),
  url: vi.fn(),
  location: vi.fn(),
  directory: vi.fn(async () => ({ items: [], prefixes: [] }))
}))

import { paths } from '@/persistence/store-paths'

describe('store paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // optimize builds itemids without a leading slash; without the slash
  // as_filename skips the `people/` prefix and the archive move targets a path
  // the storage rules deny.
  it('prefixes a slashless poster id with people/', async () => {
    expect(await paths.storage_path('+15551234567/posters/1000')).toBe(
      'people/+15551234567/posters/1000.html.gz'
    )
  })

  it('lists the poster and its six layers for an archived move', async () => {
    const files = await paths.files('+15551234567/posters/1000', 999)

    expect(files).toHaveLength(7)
    expect(files[0]).toBe('people/+15551234567/posters/999/1000.html.gz')
    expect(files.at(-1)).toBe(
      'people/+15551234567/posters/999/1000-boulders.html.gz'
    )
  })

  it('siblings are the six layers of a poster only', () => {
    expect(paths.siblings('/+15551234567/posters/1000')).toHaveLength(6)
    expect(paths.siblings('/+15551234567/shadows/1000')).toEqual([])
    expect(paths.siblings('/+15551234567/thoughts/1000')).toEqual([])
  })
})
