import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const onAuthStateChanged = jest.fn(state_changed => state_changed())
jest.spyOn(firebase, 'auth').mockImplementation(() => {
  return { onAuthStateChanged }
})
describe('@/components/main-nav.vue', () => {
  let wrapper
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(main_nav)
  })
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
    it('app is initialized with wat-textarea alone on the page', () => {
      expect(wrapper.vm.onboarding.has_posts).toBe(false)
      expect(wrapper.vm.onboarding.is_person).toBe(false)
      expect(wrapper.vm.onboarding.has_friends).toBe(false)
      expect(wrapper.vm.onboarding.can_event).toBe(false)
      expect(wrapper.vm.onboarding.can_where).toBe(false)
    })
    describe('signed in', () => {
      const person = {
        first_name: 'Scott',
        last_name: 'Fryxell',
        mobile: '4151234356'
      }
      const is_signed_in = jest.fn((state_changed) => {
        state_changed({user: person})
      })
      beforeEach(() => {
        jest.spyOn(firebase, 'auth').mockImplementation(() => {
          return { onAuthStateChanged: is_signed_in }
        })
      })
      it('relations is visible', () => {
        wrapper = shallow(main_nav, {
          data: { person: person }
        })
        expect(wrapper.vm.onboarding.is_person).toBe(true)
      })
      it('feed is be visible when person has added a friend', () => {
        localStorage.setItem('relations-count', 1)
        wrapper = shallow(main_nav, {
          data: { person: person }
        })
        expect(wrapper.vm.onboarding.has_friends).toBe(true)
      })
      it('events will be visible when person has 5 friends', () => {
        localStorage.setItem('relations-count', 5)
        wrapper = shallow(main_nav, {
          data: { person: person }
        })
        expect(wrapper.vm.onboarding.can_event).toBe(true)
      })
      it('where will be visible when person has 25 friends', () => {
        localStorage.setItem('relations-count', 25)
        wrapper = shallow(main_nav, {
          data: { person: person }
        })
        expect(wrapper.vm.onboarding.can_where).toBe(true)
      })
    })
    it('profile is be visible when person has posted', () => {
      localStorage.setItem('posts-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.has_posts).toBe(true)
    })
  })
  describe('user_name()', () => {
    it('returns \'Profile\' by default', () => {
      expect(wrapper.vm.user_name).toBe('Profile')
    })
    it('returns the users first name if set', () => {
      wrapper.setData({ person: {first_name: 'Scott'} })
      expect(wrapper.vm.user_name).toBe('Scott')
    })
  })
})
