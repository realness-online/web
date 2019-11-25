import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
import Index from '@/views/Index'
import Storage, { person_storage } from '@/storage/Storage'

import profile from '@/helpers/profile'
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
describe('@/views/Index.vue', () => {
  let wrapper
  beforeEach(async() => {
    jest.spyOn(profile, 'load').mockImplementation(() => person)
    jest.spyOn(person_storage, 'as_object').mockImplementation(_ => person)
    sessionStorage.setItem('posts-synced', Date.now())
    const currentUser = {
      phoneNumber: '+16282281824'
    }
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(Index)
    wrapper.setData({version: '1.0.0'})
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
  it('Add a post when post-added is emited', async() => {
    expect(wrapper.vm.days.size).toBe(0)
    wrapper.vm.$emit('post-added', post)
    await flushPromises()
    wrapper.vm.add_post(post)
    expect(wrapper.vm.days.size).toBe(1)
    expect(wrapper.find('ol')).toBeTruthy()
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
      const signed_out = jest.fn(state_changed => state_changed(null))
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
        return { onAuthStateChanged: signed_out }
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
        wrapper.vm.add_post(post)
        expect(wrapper.vm.has_posts).toBe(true)
      })
    })
    describe('onBoarding()', () => {
      describe('signed out', () => {
        it('textarea is the only navigation element to start', () => {
          const signed_out = jest.fn(state_changed => {
            state_changed(null)
          })
          jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
            return { onAuthStateChanged: signed_out }
          })
          wrapper = shallow(Index)
          expect(wrapper.vm.onboarding['has-posts']).toBeFalsy()
          expect(wrapper.vm.onboarding['signed-in']).toBeFalsy()
          expect(wrapper.vm.onboarding['has-friends']).toBeFalsy()
        })
        it('Profile button is visible when person has posted', () => {
          jest.spyOn(Storage.prototype, 'as_list').mockImplementation(() => {
            return [post]
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
          jest.spyOn(Storage.prototype, 'as_list').mockImplementation(() => {
            return [post]
          })
          wrapper = shallow(Index)
          expect(wrapper.vm.onboarding['has-friends']).toBe(true)
        })
      })
    })
    describe('#user_name', () => {
      it('Returns \'You\' by default', () => {
        wrapper.vm.me = {}
        expect(wrapper.vm.user_name).toBe('You')
      })
      it('Returns the users first name if set', () => {
        expect(wrapper.vm.user_name).toBe('Scott')
      })
    })
  })
})
