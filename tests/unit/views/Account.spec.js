import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import Account from '@/views/Account'
import Storage, { person_storage } from '@/modules/Storage'
import profile_id from '@/models/profile_id'
import convert_to_avatar from '@/modules/convert_to_avatar'
import flushPromises from 'flush-promises'
describe('@/views/Account.vue', () => {
  let wrapper
  const me = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    id: '/+16282281824'
  }
  beforeEach(() => {
    jest.spyOn(profile_id, 'load').mockImplementation(() => Promise.resolve(me))
    wrapper = shallow(Account)
  })
  it('Renders account information', async() => {
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('adding an avatar', () => {
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
      it('Should update the avatar', () => {
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
      it('Should trigger change event on file input', () => {
        // wrapper.setProps({ view_avatar: true })
        let input = wrapper.find('input[type=file]')
        expect(input.exists()).toBe(true)
        input.element.value = ''
        input.trigger('change')
        // currently no way to test file inputs. let's trigger the event anyway
      })
    })
    describe('#save_me', () => {
      it('saves a user', async() => {
        const spy = jest.spyOn(person_storage, 'save')
        .mockImplementation(() => Promise.resolve('spy'))
        await wrapper.vm.save_me()
        await flushPromises()
        expect(spy).toBeCalled()
      })
    })
    describe('#attach_poster', () => {
      it('change file input to attach image rahter than capture', () => {
        expect(wrapper.vm.$refs.uploader.hasAttribute('capture')).toBe(true)
        wrapper.vm.attach_poster()
        expect(wrapper.vm.$refs.uploader.hasAttribute('capture')).toBe(false)
      })
    })
    describe('#vectorize_image', () => {
      it('Should vectorize a jpg', () => {
        const image = { i: 'would be an image in real life' }
        const spy = jest.fn(() => Promise.resolve('trace_spy'))
        jest.spyOn(convert_to_avatar, 'trace').mockImplementation(() => spy)
        wrapper.vm.vectorize_image(image)
        expect(wrapper.vm.avatar_changed).toBe(true)
      })
    })
  })
})
