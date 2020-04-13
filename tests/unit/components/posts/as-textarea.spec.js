import { shallow } from 'vue-test-utils'
import wat from '@/components/posts/as-textarea'
describe ('@/components/posts/as-textarea.vue', () => {
  it ('Renders', () => {
    const wrapper = shallow(wat)
    expect(wrapper.element).toMatchSnapshot()
  })
  it ('#wat_focused() exists', () => {
    expect(typeof wat.methods.wat_focused).toBe('function')
  })
  describe ('#prepare_post', () => {
    it ('Exists', () => {
      expect(typeof wat.methods.prepare_post).toBe('function')
    })
    it ('Only triggers a post event when there is text', () => {
      const wrapper = shallow(wat, {
        data: {
          posts: [],
          new_post: ''
        }
      })
      expect(wrapper.vm.posts.length).toBe(0)
      wrapper.vm.prepare_post()
      expect(wrapper.vm.posts.length).toBe(0)
    })
  })
  describe ('focus', () => {
    it ('Emits a toggle-keyboard event when focused', () => {
      const wrapper = shallow(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('toggle-keyboard', spy)
      textarea.trigger('focusin')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it ('Emits a toggle-keyboard event when loosing focus', () => {
      const wrapper = shallow(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('toggle-keyboard', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it ('Emits a post-added event when there is text', () => {
      const wrapper = shallow(wat, {
        data: {
          new_post: 'I like to move it.'
        }
      })
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('post-added', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it ('Does not emit post-added when there is not text', () => {
      const wrapper = shallow(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('post-added', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(0)
    })
  })
})
