import { shallowMount } from '@vue/test-utils'
import as_messenger from '@/components/profile/as-messenger'
describe('@/components/profile/as-messenger', () => {
  describe('Renders', () => {
    it('Messenger button', () => {
      const wrapper = shallowMount(as_messenger, {
        props: { itemid: '/+14155550142' }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Links to the messaging app the user prefers for phone numbers', () => {
      const wrapper = shallowMount(as_messenger, {
        props: { itemid: '/+14155550142' }
      })
      expect(wrapper.attributes('href')).toBe('sms:14155550142')
    })
  })
})
