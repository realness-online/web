import { shallowMount } from '@vue/test-utils'
import as_link from '@/components/profile/as-link'
describe('@/components/profile/as-link', () => {
  describe('Renders', () => {
    it('Messenger button to message people directly', () => {
      const wrapper = shallowMount(as_link, {
        props: { itemid: '/+16282281824' }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
