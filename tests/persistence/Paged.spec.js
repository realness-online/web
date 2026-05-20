import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import { Paged } from '@/persistence/Paged'
import { Storage } from '@/persistence/Storage'

vi.mock('@/utils/serverless', () => ({
  current_user: {
    value: { phoneNumber: '+15551234567' }
  }
}))

vi.mock('@/utils/itemid', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    list: vi.fn(),
    load_from_network: vi.fn()
  }
})

vi.mock('@/persistence/History', () => ({
  History: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(true)
  }))
}))

import { list, load_from_network } from '@/utils/itemid'

class TestPaged extends Paged(Storage) {
  constructor(id) {
    super(id)
  }
}

describe('@/persistence/Paged', () => {
  let paged

  beforeEach(() => {
    vi.clearAllMocks()
    paged = new TestPaged('/+15551234567/posters/')
    localStorage.clear()
  })

  describe('sync', () => {
    it('merges cloud and local items', async () => {
      const cloud_item = { id: '/+15551234567/posters/200', name: 'cloud' }
      const local_item = { id: '/+15551234567/posters/300', name: 'local' }

      load_from_network.mockResolvedValue({
        id: paged.id,
        posters: [cloud_item]
      })
      list.mockResolvedValue([local_item])
      localStorage.removeItem('/+/posters')

      const items = await paged.sync()

      expect(items.map(i => i.id).sort()).toEqual(
        [cloud_item.id, local_item.id].sort()
      )
    })

    it('merges offline localStorage posters with rewritten ids', async () => {
      load_from_network.mockResolvedValue(null)
      list.mockResolvedValue([])
      localStorage.setItem(
        '/+/posters',
        `<div itemscope itemid="/+/posters">
          <svg itemprop="posters" itemscope itemid="/+/posters/999888777" viewBox="0 0 1 1"></svg>
        </div>`
      )

      const items = await paged.sync()

      expect(items.some(i => i.id === '/+15551234567/posters/999888777')).toBe(
        true
      )
    })

    it('drops local items older than cloud archive watermark', async () => {
      load_from_network.mockResolvedValue({
        id: paged.id,
        posters: [{ id: '/+15551234567/posters/500', name: 'newest-cloud' }]
      })
      list.mockResolvedValue([
        { id: '/+15551234567/posters/100', name: 'stale-local' }
      ])
      localStorage.removeItem('/+/posters')

      const items = await paged.sync()

      expect(items.some(i => i.id === '/+15551234567/posters/100')).toBe(false)
      expect(items.some(i => i.id === '/+15551234567/posters/500')).toBe(true)
    })
  })
})
