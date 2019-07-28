import { shallow } from 'vue-test-utils'
import Storage from '@/modules/Storage'
import my_list from '@/components/posts/my-list'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/components/posts/my-list.vue', () => {
  let wrapper
  const post = {
    created_at: '2017-12-20T23:01:14.310Z',
    articleBody: 'I like to move it'
  }
  beforeEach(async() => {
    sessionStorage.setItem('posts-synced', Date.now())
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { currentUser: person }
    })
    wrapper = shallow(my_list)
    await flushPromises()
  })
  afterEach(() => {
    sessionStorage.removeItem('posts-synced')
  })
  it('Render proper item properties', () => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=posts]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
  it('Add an activity when post-added is emited', () => {
    expect(wrapper.vm.pages[0].length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.pages[0].length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })
  describe('syncing my posts', () => {
    let sync_list_spy
    const six_minutes_ago = Date.now() - (1000 * 60 * 6)
    beforeEach(() => {
      sync_list_spy = jest.spyOn(Storage.prototype, 'sync_list').mockImplementation(() => {
        return Promise.resolve([
          {
            articleBody: 'mock post'
          },
          {
            articleBody: 'another mock post'
          }
        ])
      })
    })
    it('Wait to sync until the user is signed in', async() => {
      sessionStorage.setItem('posts-synced', six_minutes_ago)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { currentUser: null }
      })
      shallow(my_list)
      await flushPromises()
      expect(sync_list_spy).not.toBeCalled()
    })
    it('Wait to sync with the server for five minutes', () => {
      expect(sync_list_spy).not.toBeCalled()
      sessionStorage.setItem('posts-synced', six_minutes_ago)
    })
    it('Sync after five minutes minutes', async() => {
      sessionStorage.setItem('posts-synced', six_minutes_ago)
      wrapper = shallow(my_list)
      await flushPromises()
      expect(sync_list_spy).toBeCalled()
    })
    it('Sync with the server with every new session', async() => {
      sessionStorage.removeItem('posts-synced')
      wrapper = shallow(my_list)
      await flushPromises()
      expect(sync_list_spy).toBeCalled()
    })
  })
})
