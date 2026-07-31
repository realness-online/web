import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
  keys: vi.fn(() => Promise.resolve([]))
}))

const author = '/+14156667777'
const stored_keys = [
  `${author}/posters/1000`,
  `${author}/posters/2000`,
  `${author}/shadows/2000`,
  `${author}/thoughts/3000`,
  '/+19998887777/posters/4000',
  'sync:index',
  author
]

describe('build_local_directory', () => {
  beforeEach(async () => {
    const { keys } = await import('idb-keyval')
    keys.mockClear()
    keys.mockResolvedValue(stored_keys)
  })

  it('lists the created_ats stored under one directory', async () => {
    const { build_local_directory } = await import('@/persistence/Directory')

    const directory = await build_local_directory(`${author}/posters/`)

    expect(directory.items).toEqual([1000, 2000])
  })

  it('reads the store once for authors listed at the same time', async () => {
    const { build_local_directory, as_directory_id } =
      await import('@/persistence/Directory')
    const { keys } = await import('idb-keyval')

    const [mine, theirs] = await Promise.all([
      build_local_directory(`${author}/posters/`),
      build_local_directory('/+19998887777/posters/')
    ])

    expect(keys).toHaveBeenCalledTimes(1)
    expect(mine.items).toEqual([1000, 2000])
    expect(theirs.items).toEqual([4000])
    expect(mine.id).toBe(as_directory_id(`${author}/posters/`))
  })

  it('rescans for a listing asked for after the last one resolved', async () => {
    const { build_local_directory } = await import('@/persistence/Directory')
    const { keys } = await import('idb-keyval')

    await build_local_directory(`${author}/posters/`)
    keys.mockResolvedValue([...stored_keys, `${author}/posters/5000`])
    const second = await build_local_directory(`${author}/posters/`)

    expect(keys).toHaveBeenCalledTimes(2)
    expect(second.items).toEqual([1000, 2000, 5000])
  })

  it('hands each caller its own array', async () => {
    const { build_local_directory } = await import('@/persistence/Directory')

    const first = await build_local_directory(`${author}/posters/`)
    first.items.push(9999)
    const second = await build_local_directory(`${author}/posters/`)

    expect(second.items).toEqual([1000, 2000])
  })
})
