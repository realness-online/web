import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import 'firebase/auth'
import Editor from '@/views/Editor'
const user = { phoneNumber: '/+16282281824' }

describe('@/views/Editor.vue', () => {
  describe('Renders', () => {
    it('Shows an editor for a poster or an avatar', async () => {
      firebase.user = user
      const $route = { params: { phone_number: '+14151231234' } }
      const wrapper = await shallowMount(Editor)
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
  })
})
