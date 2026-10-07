import { shallowMount } from '@vue/test-utils'
import as_messenger from '@/components/profile/as-messenger'
describe('@/components/profile/as-messenger', () => {
  describe('Renders', () => {
    it('Messenger button', () => {
      const wrapper = shallowMount(as_messenger, {
        props: { itemid: '/+16282281824' }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Links to the messaging app the user prefers for phone numbers', () => {
      const wrapper = shallowMount(as_messenger, {
        props: { itemid: '/+16282281824' }
      })
      expect(wrapper.attributes('href')).toBe('sms:16282281824')
    })
  })
})
