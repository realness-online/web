import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Posters from '@/views/Posters'

const MOCK_YEAR = 2020

describe('@/views/Posters', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(Posters)
  })

  describe('Rendering', () => {
    it('renders posters view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  // Restructured to avoid excessive nesting
  describe('Poster Management', () => {
    const test_poster = {
      id: '123',
      title: 'Test Poster',
      content: 'Test Content'
    }

    it('loads posters from storage', async () => {
      await wrapper.vm.load_posters()
      expect(wrapper.vm.posters).toEqual([])
    })

    it('saves new poster', async () => {
      await wrapper.vm.save_poster(test_poster)
      expect(wrapper.vm.posters).toContain(test_poster)
    })

    it('removes existing poster', async () => {
      wrapper.vm.posters = [test_poster]
      await wrapper.vm.remove_poster(test_poster)
      expect(wrapper.vm.posters).not.toContain(test_poster)
    })

    it('updates poster', async () => {
      const updated_poster = { ...test_poster, title: 'Updated Title' }
      wrapper.vm.posters = [test_poster]
      await wrapper.vm.update_poster(updated_poster)
      expect(wrapper.vm.posters[0].title).toBe('Updated Title')
    })
  })
})
