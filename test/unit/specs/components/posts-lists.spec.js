import {shallow} from 'vue-test-utils'
import post_list from '@/components/posts-list'

describe('posts-list.vue', () => {
  let wrapper
  const post = {
    created_at: '2017-12-20T23:01:14.310Z',
    articleBody: 'I like to move it'
  }
  beforeEach(() => {
    wrapper = shallow(post_list)
  })

  it('should render (ol#activity)', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('sets posts_count to the correct local storage')

  it('should render some posts', () => {
    const post = {
      created_at: '2017-12-20T23:01:14.310Z',
      articleBody: 'I like to move it'
    }
    wrapper.setData({posts: [post]})
    expect(wrapper.element).toMatchSnapshot()
  })

  it('should add an activity when post-added is emited', () => {
    expect(wrapper.vm.posts.length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.posts.length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })


})
