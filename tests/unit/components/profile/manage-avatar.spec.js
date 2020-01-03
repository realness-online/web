import { shallow } from 'vue-test-utils'
import manage_avatar from '@/components/profile/manage-avatar'
import Storage from '@/persistance/Storage'
import flushPromises from 'flush-promises'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const currentUser = {
  phoneNumber: '+16282281824'
}
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/components/profile/manage-avatar.vue', () => {
  let wrapper
  beforeEach(() => {
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(manage_avatar, {
      propsData: { person }
    })
  })
  it('Render avatar manager', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('methods', () => {
    describe('#open_camera', () => {
      it('Should open the file dialog', () => {
        // wrapper.setProps({ view_avatar: true })
        let mock_click = jest.fn()
        wrapper.vm.$refs.uploader.click = mock_click
        wrapper.vm.open_camera()
        expect(mock_click).toBeCalled()
      })
    })
    describe('#accept_changes', () => {
      it('Should update the avatar', async() => {
        const save_spy = jest.fn(() => Promise.resolve())
        jest.spyOn(Storage.prototype, 'save').mockImplementation(save_spy)
        wrapper.setData({ avatar_changed: true })
        wrapper.vm.accept_changes()
        await flushPromises()
        expect(wrapper.vm.avatar_changed).toBe(false)
        expect(save_spy).toBeCalled()
      })
      it('Should trigger change event on file input', () => {
        // wrapper.setProps({ view_avatar: true })
        let input = wrapper.find('input[type=file]')
        expect(input.exists()).toBe(true)
        input.element.value = ''
        input.trigger('change')
        // currently no way to test file inputs. let's trigger the event anyway
      })
    })
    describe('#select_photo', () => {
      it('Change file input to attach image rahter than capture', () => {
        expect(wrapper.vm.$refs.uploader.hasAttribute('capture')).toBe(true)
        wrapper.vm.select_photo()
        expect(wrapper.vm.$refs.uploader.hasAttribute('capture')).toBe(false)
      })
    })
    describe('#vectorize_image', () => {
      it('Should vectorize a jpg', () => {
        const image = { i: 'would be an image in real life' }
        wrapper.vm.vectorize_image(image)
        expect(wrapper.vm.avatar_changed).toBe(true)
      })
    })
  })
})
