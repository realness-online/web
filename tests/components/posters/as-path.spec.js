import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_path from '@/components/posters/as-path'

// Mock DOM element for path
const mock_path_element = {
  getAttribute: vi.fn().mockReturnValue('M0,0 L100,100'),
  setAttribute: vi.fn(),
  style: {}
}

// Mock path composable
vi.mock('@/use/path', () => ({
  is_path: vi.fn().mockReturnValue(true)
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  is_vector_id: vi.fn().mockReturnValue(true)
}))

// Mock preferences
vi.mock('@/utils/preference', () => ({
  stroke: { value: '#000000' },
  shadow: { value: '#ffffff' }
}))

describe('@/components/posters/as-path.vue', () => {
  describe('Renders', () => {
    it('a path from one provided', () => {
      const wrapper = shallowMount(as_path, {
        props: {
          itemprop: 'regular',
          path: mock_path_element,
          fill: '#ffffff',
          stroke: '#000000',
          id: 'test-path'
        }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
