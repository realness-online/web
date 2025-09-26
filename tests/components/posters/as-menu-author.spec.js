import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_author_menu from '@/components/posters/as-menu-author'

// Mock key-commands composable
vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn()
  })
}))

// Mock poster data instead of using non-existent get_item
const poster = {
  id: '/+14151234356/posters/1737178477987',
  type: 'poster',
  content: '<svg><rect width="100" height="100"/></svg>'
}
describe('@/components/posters/as-menu-author.vue', () => {
  describe('Renders', () => {
    it('a menu to edit a poster', () => {
      const wrapper = shallowMount(as_author_menu, { props: { poster } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
