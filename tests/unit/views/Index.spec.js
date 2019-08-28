import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
import Index from '@/views/Index'
import Storage from '@/modules/Storage'
import LocalStorage from '@/modules/LocalStorage'
import profile_id from '@/helpers/profile'
const six_minutes_ago = Date.now() - (1000 * 60 * 6)
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const currentUser = {
  phoneNumber: '+16282281824'
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
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged, currentUser }
    })
    wrapper = shallow(Index)
    await flushPromises()
  })
  afterEach(() => {
    sessionStorage.removeItem('posts-synced')
    wrapper.destroy()
  })
  it('Renders posts and profile for a person', async() => {
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
          { statement: 'mock post' },
          { statement: 'another mock post' }
        ])
      })
    })
    it('Wait to sync until the user is signed in', async() => {
      sessionStorage.setItem('posts-synced', six_minutes_ago)
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
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
  describe('navigating the application', () => {
    describe('handling post events', () => {
      it('posting:false should render the main navigation', () => {
        expect(wrapper.vm.posting).toBe(false)
        expect(wrapper.element).toMatchSnapshot()
      })
      it('posting:true should hide main navigation', () => {
        wrapper.setData({ posting: true })
        expect(wrapper.element).toMatchSnapshot()
      })
      it('post-added event should set has_posts to true', () => {
        expect(wrapper.vm.has_posts).toBe(false)
        wrapper.vm.$bus.$emit('post-added')
        expect(wrapper.vm.has_posts).toBe(true)
      })
    })
    describe('onBoarding()', () => {
      describe('signed out', () => {
        it('textarea is the only navigation element to start', () => {
          jest.spyOn(firebase, 'auth').mockImplementation(() => {
            return { currentUser: null }
          })
          wrapper = shallow(Index)
          console.log(wrapper.vm.onboarding)
          expect(wrapper.vm.onboarding['has-posts']).toBeFalsy()
          expect(wrapper.vm.onboarding['signed-in']).toBeFalsy()
          expect(wrapper.vm.onboarding['has-friends']).toBeFalsy()
        })
        it.only('Profile button is visible when person has posted', () => {
          jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(() => {
            return new Array(1)
          })
          const wrapper = shallow(Index)
          expect(wrapper.vm.onboarding['has-posts']).toBe(true)
        })
      })
      describe('signed in', () => {
        it('Relations is visible', () => {
          wrapper = shallow(Index)
          expect(wrapper.vm.onboarding['signed-in']).toBe(true)
        })
        it('Feed, Events and posters are visible when person has added a friend', () => {
          jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(() => {
            return new Array(1)
          })
          wrapper = shallow(Index)
          expect(wrapper.vm.onboarding['has-friends']).toBe(true)
        })
      })
    })
    describe('#user_name', () => {
      it('Returns \'You\' by default', () => {
        expect(wrapper.vm.user_name).toBe('You')
      })
      it('Returns the users first name if set', () => {
        wrapper.setData({ person: { first_name: 'Scott' } })
        expect(wrapper.vm.user_name).toBe('Scott')
      })
    })
  })
})
