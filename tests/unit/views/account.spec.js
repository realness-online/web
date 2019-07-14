import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import Account from '@/views/Account'
import Storage from '@/modules/Storage'
import profile_id from '@/modules/profile_id'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const onAuthStateChanged = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '14151231234'
  })
})
describe('@/views/Account.vue', () => {
  let wrapper
  const me = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    id: '/+16282281824'
  }
  beforeEach(() => {
    jest.spyOn(profile_id, 'load').mockImplementation(() => Promise.resolve(me))
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(Account)
  })
  it('renders event information', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('adding an avatar', () => {
    it('open_camera()', () => {
      // wrapper.setProps({ view_avatar: true })
      let mock_click = jest.fn()
      wrapper.vm.$refs.uploader.click = mock_click
      wrapper.vm.open_camera()
      expect(mock_click).toBeCalled()
    })
    describe('accept_changes()', () => {
      it('should update the avatar', () => {
        const localVue = createLocalVue()
        localVue.use(VueRouter)
        const router = new VueRouter()
        let wrapper = shallow(Account, {
          localVue,
          router
        })
        wrapper.setData({ avatar_changed: true })
        const save_spy = jest.fn(() => Promise.resolve('save_spy'))
        jest.spyOn(Storage.prototype, 'save').mockImplementation(save_spy)
        wrapper.vm.accept_changes()
        expect(save_spy).toBeCalled()
      })
      it('should trigger change event on file input', () => {
        // wrapper.setProps({ view_avatar: true })
        let input = wrapper.find('input[type=file]')
        expect(input.exists()).toBe(true)
        input.element.value = ''
        input.trigger('change')
        // currently no way to test file inputs. let's trigger the event anyway
      })
    })
  })
})
