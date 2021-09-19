import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import 'firebase/auth'
import Opacity from '@/views/Opacity'
import Events from '@/views/Events'
const user = { phoneNumber: '/+16282281824' }

describe('@/views/Opacity.vue', () => {
  describe('Renders', () => {
    it('Shows an editor for a poster or an avatar', async () => {
      firebase.user = user
      const $route = { params: { phone_number: '+14151231234' } }
      const wrapper = await shallowMount(Editor, {
        mocks: { $route },
        stubs: ['router-link', 'router-view']
      })
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
  })
})
