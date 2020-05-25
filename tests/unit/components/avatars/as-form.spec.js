import { shallow } from 'vue-test-utils'
import as_form from '@/components/avatars/as-form'
import { Avatar } from '@/persistance/Storage'
import flushPromises from 'flush-promises'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const currentUser = {
  phoneNumber: '+16282281824'
}
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  avatar: 'avatars/1578929551564'
}
describe('@/components/avatars/as-form.vue', () => {
  let wrapper
  beforeEach(() => {
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(as_form, {
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
        const mock_click = jest.fn()
        wrapper.vm.$refs.uploader.click = mock_click
        wrapper.vm.open_camera()
        expect(mock_click).toBeCalled()
      })
    })
    describe('#accept_new_avatar', () => {
      it('Should update the avatar', async () => {
        const save_spy = jest.fn(() => Promise.resolve())
        jest.spyOn(Avatar.prototype, 'save').mockImplementation(save_spy)
        wrapper.setData({
          avatar_changed: true,
          avatar: {
            id: 'avatars/153423367'
          }
        })
        wrapper.vm.accept_new_avatar()
        await flushPromises()
        expect(wrapper.vm.avatar_changed).toBe(false)
        expect(save_spy).toBeCalled()
      })
      it('Should trigger change event on file input', () => {
        // wrapper.setProps({ view_avatar: true })
        const input = wrapper.find('input[type=file]')
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
        const post_message_spy = jest.fn()
        wrapper.setData({
          worker: {
            postMessage: post_message_spy
          }
        })
        const image = { i: 'would be an image in real life' }
        wrapper.vm.vectorize_image(image)
        expect(wrapper.vm.working).toBe(true)
        expect(post_message_spy).toBeCalled()
      })
    })
  })
})
