import {shallow} from 'vue-test-utils'
import wat from '@/components/posts/as-textarea'

describe('@/components/posts/as-textarea.vue', () => {
  it('renders a textarea', () => {
    let wrapper = shallow(wat)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('prepare_post() exists', () => {
    expect(typeof wat.methods.prepare_post).toBe('function')
  })
  it('emits an event when focused', () => {
    let wrapper = shallow(wat)
    const textarea = wrapper.find('#wat')
    const spy = jest.fn()
    wrapper.vm.$on('toggle-keyboard', spy)
    textarea.trigger('focusin')
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('emits an event when it looses focus', () => {
    let wrapper = shallow(wat)
    const textarea = wrapper.find('#wat')
    const spy = jest.fn()
    wrapper.vm.$on('toggle-keyboard', spy)
    textarea.trigger('focusout')
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('emits an post-added event when there is text', () => {
    let wrapper = shallow(wat, {
      data: {
        new_post: 'I like to move it.'
      }
    })
    const textarea = wrapper.find('#wat')
    const spy = jest.fn()
    wrapper.vm.$bus.$on('post-added', spy)
    textarea.trigger('focusout')
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('does not emit post-added when there is not text', () => {
    let wrapper = shallow(wat)
    const textarea = wrapper.find('#wat')
    const spy = jest.fn()
    wrapper.vm.$on('post-added', spy)
    textarea.trigger('focusout')
    expect(spy).toHaveBeenCalledTimes(0)
  })
  it('add_post() only adds a post when there is text', () => {
    let wrapper = shallow(wat, {
      data: {
        activity: [],
        posts: [],
        new_post: ''
      }
    })
    expect(wrapper.vm.posts.length).toBe(0)
    expect(wrapper.vm.activity.length).toBe(0)
    wrapper.vm.prepare_post()
    expect(wrapper.vm.posts.length).toBe(0)
    expect(wrapper.vm.activity.length).toBe(0)
  })
})
