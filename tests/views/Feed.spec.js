import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Feed from '@/views/Feed'

describe('@/views/Feed', () => {
  let wrapper
  const mock_feed_data = {
    items: [
      { id: 1, content: 'Test post 1' },
      { id: 2, content: 'Test post 2' }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mock_feed_data)
    })
    wrapper = shallowMount(Feed)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders feed component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  // Split feed operations into separate describe blocks
  describe('Feed Loading', () => {
    it('loads feed data on mount', async () => {
      await wrapper.vm.load_feed()
      expect(wrapper.vm.feed_items).toEqual(mock_feed_data.items)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('handles feed loading errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
      await wrapper.vm.load_feed()
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Feed Interactions', () => {
    it('refreshes feed data', async () => {
      await wrapper.vm.refresh_feed()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.feed_items).toEqual(mock_feed_data.items)
    })

    it('filters feed items', () => {
      wrapper.vm.feed_items = mock_feed_data.items
      wrapper.vm.filter_term = 'Test post 1'
      expect(wrapper.vm.filtered_items).toHaveLength(1)
    })
  })

  describe('Feed Updates', () => {
    it('adds new items to feed', () => {
      const new_item = { id: 3, content: 'New post' }
      wrapper.vm.add_feed_item(new_item)
      expect(wrapper.vm.feed_items).toContain(new_item)
    })
  })
})
