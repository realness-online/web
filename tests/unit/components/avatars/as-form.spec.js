import { shallowMount } from '@vue/test-utils'
import as_form from '@/components/avatars/as-form'
import { Avatar } from '@/persistance/Storage'
import flushPromises from 'flush-promises'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const avatar_html = require('fs').readFileSync('./tests/unit/html/avatar.html', 'utf8')
const user = {
  phoneNumber: '+16282281824'
}
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  avatar: '/+14151234356/avatars/1578929551564'
}
describe('@/components/avatars/as-form.vue', () => {
  let wrapper
  beforeEach(() => {
    firebase.user = user
    wrapper = shallowMount(as_form, {
      propsData: { person }
    })
  })
  afterEach(() => {
    firebase.user = null
  })
  describe('Rendering', () => {
    it('With an avatar', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Without an avatar', () => {
      const avatar_less = { ...person }
      avatar_less.avatar = null
      wrapper = shallowMount(as_form, {
        propsData: { person: avatar_less }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Unmounts the worker when destroyed', () => {
      const mock = jest.fn()
      wrapper.vm.vectorizer = { terminate: mock }
      wrapper.vm.optimizer = { terminate: mock }
      wrapper.destroy()
      expect(mock).toHaveBeenCalledTimes(2)
    })
  })
  describe('computed:', () => {
    describe('.path', () => {
      it('returns null if the form is working', () => {
        wrapper.vm.working = true
        expect(wrapper.vm.path).toBe(null)
      })
      it('returns the path if it\'s a string', () => {
        wrapper.vm.vector = {
          id: person.avatar,
          path: '<path itemprop="path" d="1"/>'
        }
        expect(wrapper.vm.path).toBe('<path itemprop="path" d="1"/>')
      })
      it('returns a string of all the paths if avatar.path is an array', () => {
        wrapper.vm.vector = {
          id: person.avatar,
          path: [
            '<path itemprop="path" d="1"/>',
            '<path itemprop="path" d="2"/>'
          ]
        }
        expect(wrapper.vm.path.length).toBe(59)
      })
    })
  })
  describe('watch:', () => {
    describe('.working', () => {
      it('posts a message to the optimizer when there a new avatar', async () => {
        const worker = {
          postMessage: jest.fn()
        }
        await wrapper.setData({
          optimizer: worker
        })
        wrapper.vm.working = true
        wrapper.vm.vector = { id: 'chill' }
        await wrapper.vm.$nextTick()
        expect(worker.postMessage).not.toBeCalled()
        await wrapper.setData({ working: false })
        await wrapper.vm.$nextTick()
        expect(worker.postMessage).toBeCalled()
      })
    })
  })
  describe('methods:', () => {
    describe('#set_current_avatar', () => {
      it('sets a new current avatar', () => {
        wrapper.vm.set_current_avatar({ id: '/+/avatars/1578929551564' })
      })
    })
    describe('#vectorize', () => {
      it('Should vectorize a jpg', () => {
        const worker = {
          postMessage: jest.fn()
        }
        wrapper.setData({
          vectorizer: worker
        })
        const image = { i: 'would be an image in real life' }
        wrapper.vm.vectorize(image)
        expect(wrapper.vm.working).toBe(true)
        expect(worker.postMessage).toBeCalled()
      })
    })
    describe('#vectorized', () => {
      const message = {
        data: {
          created_at: 'ummm',
          path: [],
          viewbox: 'viewbox'
        }
      }
      it('Sets current_avatar to new vector', () => {
        expect(wrapper.vm.current_avatar).toBe(null)
        wrapper.vm.vectorized(message)
        expect(wrapper.vm.current_avatar.id).toBe('/+14151234356/avatars/ummm')
      })
      it('sets avatar_changed to true', () => {
        wrapper.vm.avatar_changed = false
        wrapper.vm.vectorized(message)
        expect(wrapper.vm.avatar_changed).toBe(true)
      })
      it('sets working to false', () => {
        wrapper.vm.working = true
        wrapper.vm.vectorized(message)
        expect(wrapper.vm.working).toBe(false)
      })
    })
    describe('#optimized', () => {
      it('sets current_avatar with an optimized vector', () => {
        wrapper.vm.optimized({
          data: {
            vector: avatar_html
          }
        })
        expect(wrapper.vm.current_avatar.id).toBe('/+16282281824/avatars/55446694324')
      })
    })
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
          vector: {
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
  })
})
