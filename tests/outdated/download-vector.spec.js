import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import DownloadVector from '@/components/download-vector.vue'
import { hydrate } from '@/use/hydrate'

const POINT_COUNT = 3

describe('@/components/download-vector', () => {
  let wrapper
  const mock_vector = {
    id: 'test-vector',
    points: Array(POINT_COUNT).fill(1)
  }

  beforeEach(() => {
    wrapper = shallowMount(DownloadVector, {
      props: { vector: mock_vector }
    })
  })

  describe('Vector Operations', () => {
    it('downloads vector data', async () => {
      vi.spyOn(hydrate, 'download').mockResolvedValue(true)
      await wrapper.vm.download_vector()
      expect(hydrate.download).toHaveBeenCalledWith(mock_vector)
    })

    it('handles download errors', async () => {
      const error = new Error('Download failed')
      vi.spyOn(hydrate, 'download').mockRejectedValue(error)
      await wrapper.vm.download_vector()
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Component Display', () => {
    it('renders download button', () => {
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('shows vector info', () => {
      expect(wrapper.text()).toContain('Download')
    })
  })
})
