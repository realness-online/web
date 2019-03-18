import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import account from '@/views/account'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '14151231234'
  })
})
describe('@/views/Account.vue', () => {
  let wrapper
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged: is_signed_in }
    })
    wrapper = shallow(account)
  })
  it('renders event information', () => {
    let wrapper = shallow(account)
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
        let wrapper = shallow(account, {
          localVue,
          router
        })
        wrapper.setData({avatar_changed: true})
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
  // describe('adding a poster', () => {
  //   it('should have a button to upload')
  //   it('Should notify the service_worker about an image that needs converting')
  //   it('should let the user decide to use vector or original')
  //   it('should upload a poster to /+14156661212/poster.svg')
  // })
})
