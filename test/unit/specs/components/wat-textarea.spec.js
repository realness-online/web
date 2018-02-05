import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import wat from '@/components/wat-textarea'

describe('posts-list.vue', () => {

  it('should render an activity wrapper (ol#activity)', () => {
    let wrapper = shallow(wat)
    expect(wrapper.element).toMatchSnapshot()
  })

  it('add_post() exists', () => {
    expect(typeof wat.methods.add_post).toBe('function')
  })

  it('add_post creates a post', () => {
    let wrapper = shallow(wat, {
      data: {
        activity:[],
        posts:[],
        new_post:'I like to move it.'
      }
    })
    expect(wrapper.vm.activity.length).toBe(0)
    expect(wrapper.vm.posts.length).toBe(0)
    wrapper.vm.add_post()
    expect(wrapper.vm.posts.length).toBe(1)
    expect(wrapper.vm.activity.length).toBe(1)
  })

  it('add_post() only adds a post when there is text', () => {
    let wrapper = shallow(wat, {
      data: {
        activity:[],
        postss:[],
        new_post:''
      }
    })
    expect(wrapper.vm.posts.length).toBe(0)
    expect(wrapper.vm.activity.length).toBe(0)
    wrapper.vm.add_post()
    expect(wrapper.vm.posts.length).toBe(0)
    expect(wrapper.vm.activity.length).toBe(0)
  })

})
