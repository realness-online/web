import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
import Index from '@/views/Index'
import Storage from '@/modules/Storage'
import profile_id from '@/helpers/profile'
const six_minutes_ago = Date.now() - (1000 * 60 * 6)
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const post = {
  created_at: '2017-12-20T23:01:14.310Z',
  statement: 'I like to move it'
}
jest.spyOn(profile_id, 'load').mockImplementation(() => person)
describe('@/views/Index.vue', () => {
  let wrapper
  beforeEach(async() => {
    sessionStorage.setItem('posts-synced', Date.now())
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { currentUser: person }
    })
    wrapper = shallow(Index)
    await flushPromises()
  })
  afterEach(() => {
    sessionStorage.removeItem('posts-synced')
    wrapper.destroy()
  })
  it('Renders navigation for the application', async() => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=posts]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
  it('Add a post when post-added is emited', () => {
    expect(wrapper.vm.posts.length).toBe(0)
    wrapper.vm.$bus.$emit('post-added', post)
    expect(wrapper.vm.posts.length).toBe(1)
    expect(wrapper.find('li')).toBeTruthy()
  })
  describe('syncing posts', () => {
    let sync_list_spy
    beforeEach(() => {
      sync_list_spy = jest.spyOn(Storage.prototype, 'sync_list').mockImplementation(() => {
        return Promise.resolve([
          {
            statement: 'mock post'
          },
          {
            statement: 'another mock post'
          }
        ])
      })
    })
    it('Wait to sync until the user is signed in', async() => {
      sessionStorage.setItem('posts-synced', six_minutes_ago)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { currentUser: null }
      })
      shallow(Index)
      await flushPromises()
      expect(sync_list_spy).not.toBeCalled()
    })
    it('Wait to sync with the server for five minutes', () => {
      expect(sync_list_spy).not.toBeCalled()
      sessionStorage.setItem('posts-synced', six_minutes_ago)
    })
    it('Sync after five minutes minutes', async() => {
      sessionStorage.setItem('posts-synced', six_minutes_ago)
      wrapper = shallow(Index)
      await flushPromises()
      expect(sync_list_spy).toBeCalled()
    })
    it('Sync with the server with every new session', async() => {
      sessionStorage.removeItem('posts-synced')
      wrapper = shallow(Index)
      await flushPromises()
      expect(sync_list_spy).toBeCalled()
    })
  })
})
