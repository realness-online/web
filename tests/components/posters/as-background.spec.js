import { shallowMount } from '@vue/test-utils'
import as_background from '@/components/posters/as-background'
describe('@/components/posters/as-background.vue', () => {
  describe('Renders', () => {
    it('a new background for a poster without one', () => {
      const wrapper = shallowMount(as_background)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
