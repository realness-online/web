import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const onAuthStateChanged = jest.fn(state_changed => state_changed())
jest.spyOn(firebase, 'auth').mockImplementation(() => {
  return { onAuthStateChanged }
})
describe('@/components/main-nav.vue', () => {
  // TODO: add test to confirm that buttons show up after user posts
  let wrapper
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
    wrapper = shallow(main_nav)
  })
  describe('nav#main_nav', () => {
    it('#show:true should render the application navigation', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('#show:false should Hide navigation', () => {
      wrapper.setData({ show: false })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('post-added event should set posts to true', () => {
      wrapper.vm.$bus.$emit('post-added')
      expect(wrapper.vm.has_posts).toBe(true)
    })
  })
  describe('onBoarding()', () => {
    it('application nav initializes witn posting action', () => {
      expect(wrapper.vm.onboarding.has_posts).toBe(false)
      expect(wrapper.vm.onboarding.is_person).toBe(false)
      expect(wrapper.vm.onboarding.has_friends).toBe(false)
      expect(wrapper.vm.onboarding.can_event).toBe(false)
      expect(wrapper.vm.onboarding.can_group).toBe(false)
    })
    it('#relations is true if user is signed in')
    it('#person is true when person is signed in', () => {
      const person = {
        first_name: 'Scott',
        last_name: 'Fryxell',
        mobile: '4151234356'
      }
      const is_signed_in = jest.fn((state_changed) => {
        state_changed({user: person})
      })
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      wrapper = shallow(main_nav, {
        data: { person: person}
      })
      expect(wrapper.vm.onboarding.is_person).toBe(true)
    })
    it('#posts will be true when person posts', () => {
      localStorage.setItem('posts-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.has_posts).toBe(true)
    })
    it('#relations will be true when person adds a friend', () => {
      localStorage.setItem('friends-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.has_friends).toBe(true)
    })
    it('#events will be true when person has 5 friends', () => {
      localStorage.setItem('friends-count', 5)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.can_event).toBe(true)
    })
    it('#groups will be true when person has 25 friends', () => {
      localStorage.setItem('friends-count', 25)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.can_group).toBe(true)
    })
  })
  describe('user_name()', () => {
    it('returns profile by default', () => {
      expect(wrapper.vm.user_name).toBe('Profile')
    })
    it('returns the users first name if set', () => {
      wrapper.setData({ person: {first_name: 'Scott'} })
      expect(wrapper.vm.user_name).toBe('Scott')
    })
  })
  it('should only show relations, feed events and groups if user is signed in')
})
