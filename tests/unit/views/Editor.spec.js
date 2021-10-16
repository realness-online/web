import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import 'firebase/auth'
import Editor from '@/views/Editor'
const user = { phoneNumber: '16282281824' }

describe('@/views/Editor.vue', () => {
  describe('Renders', () => {
    it.skip('Shows an editor for a poster or an avatar', async () => {
      firebase.user = user
      localStorage.me = `/+${user.phoneNumber}`
      const $route = { params: { id: '559666932867' } }
      const wrapper = await shallowMount(Editor, {
        global: {
          mocks: { $route },
          stubs: ['router-link']
        }
      })
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
  })
})
