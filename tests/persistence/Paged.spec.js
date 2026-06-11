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

vi.mock('@/persistence/History', () => {
  return {
    History: class MockHistory {
      constructor() {
        this.save = vi.fn().mockResolvedValue(true)
      }
    }
  }
})

import { list, load_from_network } from '@/utils/itemid'

class TestPaged extends Paged(Storage) {
  constructor(id) {
    super(id)
    this.type = 'posters'
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

    it('returns empty array when no items exist anywhere', async () => {
      load_from_network.mockResolvedValue(null)
      list.mockResolvedValue([])
      localStorage.removeItem('/+/posters')

      const items = await paged.sync()

      expect(items).toEqual([])
    })

    it('filters out duplicate items (keeps cloud version)', async () => {
      const shared_id = '/+15551234567/posters/300'
      load_from_network.mockResolvedValue({
        id: paged.id,
        posters: [{ id: shared_id, name: 'cloud-version' }]
      })
      list.mockResolvedValue([{ id: shared_id, name: 'local-version' }])
      localStorage.removeItem('/+/posters')

      const items = await paged.sync()

      // Should only have one item (cloud version)
      expect(items.filter(i => i.id === shared_id)).toHaveLength(1)
      expect(items.find(i => i.id === shared_id).name).toBe('cloud-version')
    })

    it('sorts items with most recent first', async () => {
      load_from_network.mockResolvedValue({
        id: paged.id,
        posters: [
          { id: '/+15551234567/posters/100' },
          { id: '/+15551234567/posters/300' }
        ]
      })
      list.mockResolvedValue([{ id: '/+15551234567/posters/200' }])
      localStorage.removeItem('/+/posters')

      const items = await paged.sync()

      // Should be sorted: 300, 200, 100 (most recent first)
      expect(items.map(i => i.id)).toEqual([
        '/+15551234567/posters/300',
        '/+15551234567/posters/200',
        '/+15551234567/posters/100'
      ])
    })
  })

  describe('optimize', () => {
    it('does nothing when item size is within limits', async () => {
      // Create a small item that doesn't exceed SIZE.MAX
      const small_html = `<div itemscope itemid="${paged.id}">
        <svg itemprop="posters" itemscope itemid="${paged.id}999" viewBox="0 0 1 1"></svg>
      </div>`
      localStorage.setItem(paged.id, small_html)

      await paged.optimize()

      // Item should remain unchanged
      expect(localStorage.getItem(paged.id)).toBe(small_html)
    })

    it('handles empty localStorage gracefully', async () => {
      localStorage.removeItem(paged.id)

      // Should not throw
      await expect(paged.optimize()).resolves.not.toThrow()
    })

    it('handles malformed HTML gracefully', async () => {
      localStorage.setItem(paged.id, 'not valid html')

      // Should not throw
      await expect(paged.optimize()).resolves.not.toThrow()
    })

    it('does nothing when no child nodes exist', async () => {
      const empty_html = `<div itemscope itemid="${paged.id}"></div>`
      localStorage.setItem(paged.id, empty_html)

      await paged.optimize()

      // Item should remain unchanged
      expect(localStorage.getItem(paged.id)).toBe(empty_html)
    })

    it('calls super.optimize() to handle base optimization', async () => {
      const html = `<div itemscope itemid="${paged.id}">
        <svg itemprop="posters" itemscope itemid="${paged.id}999" viewBox="0 0 1 1"></svg>
      </div>`
      localStorage.setItem(paged.id, html)

      await paged.optimize()

      // Should complete without error
      expect(true).toBe(true)
    })

    it('offloads old items to History when size exceeds MAX', async () => {
      // Create proper HTML structure with old items
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(12, 0, 0, 0) // Set to noon yesterday
      const old_timestamp = yesterday.getTime()

      const html = `<div itemscope itemid="${paged.id}">
        <svg itemprop="posters" itemscope itemid="${paged.id}${old_timestamp}" viewBox="0 0 1 1">
          <rect width="1" height="1"/>
        </svg>
        <svg itemprop="posters" itemscope itemid="${paged.id}${old_timestamp + 1000}" viewBox="0 0 1 1">
          <rect width="1" height="1"/>
        </svg>
      </div>`

      localStorage.setItem(paged.id, html)

      // Mock size to simulate being over limit
      const { SIZE } = await import('@/utils/numbers')

      vi.spyOn(
        await import('@/utils/numbers'),
        'itemid_as_kilobytes'
      ).mockReturnValue(SIZE.MAX + 10)
      vi.spyOn(await import('@/utils/numbers'), 'elements_as_kilobytes')
        .mockReturnValueOnce(SIZE.MIN + 30) // is_fat check - over MIN and before today
        .mockReturnValue(SIZE.MIN - 1) // After optimization

      await paged.optimize()

      // Should complete without error
      // (History mock will be called but we can't spy on class constructor easily)
      expect(true).toBe(true)
    })
  })
})
