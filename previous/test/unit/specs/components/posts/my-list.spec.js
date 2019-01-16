import {shallow} from 'vue-test-utils'
import Storage from '@/modules/Storage'
import post_list from '@/components/posts/my-list'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356'
}
const onAuthStateChanged = jest.fn((state_changed) => {
  state_changed({user: person})
})
describe('@/components/posts/my-list.vue', () => {
  let wrapper
  const post = {
    created_at: '2017-12-20T23:01:14.310Z',
    articleBody: 'I like to move it'
  }
  beforeEach(() => {
    sessionStorage.setItem('posts_synced', 'true')
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
  })
  afterEach(() => {
    sessionStorage.removeItem('posts_synced')
  })
  it('should render proper item properties', () => {
    sessionStorage.setItem('posts_synced', 'true')
    wrapper = shallow(post_list)
    wrapper.setProps({posts: []})
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=posts]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
  it('should add an activity when post-added is emited', () => {
    sessionStorage.setItem('posts_synced', 'true')
    wrapper = shallow(post_list)
    wrapper.setProps({posts: []})
    expect(wrapper.vm.posts.length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.posts.length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })
  it('should sync with the server when person signs in', () => {
    sessionStorage.removeItem('posts_synced')
    let sync_list_spy = jest.spyOn(Storage.prototype, 'sync_list').mockImplementation(() => {
      return Promise.resolve([
        {
          articleBody: 'mock post'
        },
        {
          articleBody: 'another mock post'
        }
      ])
    })
    wrapper = shallow(post_list)
    wrapper.setProps({posts: []})
    expect(sync_list_spy).toBeCalled()
  })
})
