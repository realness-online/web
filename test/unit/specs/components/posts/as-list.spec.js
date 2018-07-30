import {shallow} from 'vue-test-utils'
import Storage from '@/modules/Storage'
import post_list from '@/components/posts/as-list'
import * as firebase from 'firebase/app'
import 'firebase/auth'
describe('@/components/posts/as-list.vue', () => {
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
  it('should sync with the server when person signs in', () => {
    // posts_storage.sync_list().then(items => (this.posts = items))
    let spy = jest.spyOn(Storage.prototype, 'sync_list').mockImplementation(() => {
      return Promise.resolve()
    })
    wrapper.vm.$bus.$emit('signed-in')
    expect(spy).toBeCalled()
  })

})
