import { shallowMount } from '@vue/test-utils'

import { current_user } from '@/use/serverless'

import Editor from '@/views/Editor'
const user = { phoneNumber: '16282281824' }
vi.mock('vue-router')
describe('@/views/Editor.vue', () => {
  describe('Renders', () => {
    it('Shows an editor for a poster or an avatar', async () => {
      current_user.value = user
      localStorage.me = `/+${user.phoneNumber}`
      // getRouter().setParams({ id: '559666932867', type: 'posters' })
      const wrapper = shallowMount(Editor)
      expect(wrapper.element).toMatchSnapshot()
      current_user.value = null
    })
  })
})
