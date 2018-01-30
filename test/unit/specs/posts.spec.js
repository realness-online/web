import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import posts from '@/posts'

describe('posts.vue', () => {

  it('add_post() exists', () => {
    expect(typeof posts.methods.add_post).toBe('function')
  })

  it('add_post creates a post', () => {
    let wrapper = shallow(posts, {
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
    let wrapper = shallow(posts, {
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
