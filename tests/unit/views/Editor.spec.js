import { shallowMount } from '@vue/test-utils'
import { getRouter } from 'vue-router-mock'
import firebase from 'firebase/app'
import 'firebase/auth'
import Editor from '@/views/Editor'
const user = { phoneNumber: '16282281824' }
describe('@/views/Editor.vue', () => {
  describe('Renders', () => {
    it('Shows an editor for a poster or an avatar', async () => {
      firebase.user = user
      localStorage.me = `/+${user.phoneNumber}`
      getRouter().setParams({ id: '559666932867' })
      const wrapper = shallowMount(Editor)
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
  })
})
