import { shallow } from 'vue-test-utils'
import LocalStorage from '@/modules/LocalStorage'
import main_nav from '@/components/main-nav'
import * as firebase from 'firebase/app'
import 'firebase/auth'
describe('@/components/main-nav.vue', () => {
  let wrapper
  describe('handling post events', () => {
    beforeEach(() => {
      wrapper = shallow(main_nav)
    })
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
      it('app is initialized with wat-textarea alone on the page', () => {
        const auth_spy = jest.spyOn(firebase, 'auth')
        auth_spy.mockImplementation(() => {
          return { currentUser: null }
        })
        wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.has_posts).toBe(false)
        expect(wrapper.vm.onboarding.is_person).toBe(false)
        expect(wrapper.vm.onboarding.has_friends).toBe(false)
        expect(wrapper.vm.onboarding.can_event).toBe(false)
        expect(wrapper.vm.onboarding.can_where).toBe(false)
        auth_spy.mockImplementation(() => {
          return { currentUser: { phoneNumber: '+16282281824' } }
        })
      })
      it('profile is visible when person has posted', () => {
        jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(() => {
          return new Array(1)
        })
        const wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.has_posts).toBe(true)
      })
    })
    describe('signed in', () => {
      it('relations is visible', () => {
        wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.is_person).toBe(true)
      })
      it('feed is visible when person has added a friend', () => {
        jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(() => {
          return new Array(1)
        })
        wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.has_friends).toBe(true)
      })
      it.skip('events will be visible when person has 5 friends', () => {
        localStorage.setItem('relations-count', 5)
        wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.can_event).toBe(true)
      })
      it('where will be visible when person has 25 friends', () => {
        jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(() => {
          return new Array(25)
        })
        wrapper = shallow(main_nav)
        expect(wrapper.vm.onboarding.can_where).toBe(true)
      })
    })
  })
  describe('user_name()', () => {
    it('returns \'You\' by default', () => {
      expect(wrapper.vm.user_name).toBe('You')
    })
    it('returns the users first name if set', () => {
      wrapper.setData({ person: { first_name: 'Scott' } })
      expect(wrapper.vm.user_name).toBe('Scott')
    })
  })
})
