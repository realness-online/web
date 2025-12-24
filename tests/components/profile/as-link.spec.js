import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_link from '@/components/profile/as-link'

// Mock the imports that the component uses
vi.mock('@/utils/itemid', () => ({
  load: vi.fn().mockResolvedValue({
    name: 'John Doe',
    avatar: '/test-avatar'
  }),
  as_author: vi.fn().mockReturnValue('/+16282281824')
}))

describe('@/components/profile/as-link', () => {
  describe('Renders', () => {
    it('Messenger button to message people directly', () => {
      const wrapper = shallowMount(as_link, {
        props: { itemid: '/+16282281824' },
        global: {
          stubs: {
            'as-avatar': true,
            'as-address': true,
            icon: true
          }
        }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
