import { shallowMount } from '@vue/test-utils'
import { vi } from 'vite-plus/test'
import as_link from '@/components/profile/as-link'

vi.mock('@/utils/itemid', () => ({
  load: vi.fn().mockResolvedValue({
    name: 'John Doe',
    avatar: '/test-avatar'
  }),
  as_author: vi.fn().mockReturnValue('/+14155550142')
}))

describe('@/components/profile/as-link', () => {
  describe('Renders', () => {
    it('Messenger button to message people directly', () => {
      const wrapper = shallowMount(as_link, {
        props: { itemid: '/+14155550142' },
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
