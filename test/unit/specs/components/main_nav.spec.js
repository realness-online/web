import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'

describe('main-nav.vue', () => {

  it('should render the application navigation', () => {
    const wrapper = shallow(main_nav)
    expect(wrapper.element).toMatchSnapshot()
  })

  // describe('show')

  describe('onBoarding()', () => {
    it('all onboarding is off at first', () => {
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.posts).toBe(false)
      expect(wrapper.vm.onboarding.person).toBe(false)
      expect(wrapper.vm.onboarding.friends).toBe(false)
      expect(wrapper.vm.onboarding.events).toBe(false)
      expect(wrapper.vm.onboarding.groups).toBe(false)
    })

    it('#person is true when person has profile info', () => {
      const wrapper = shallow(main_nav)
      wrapper.setData({ person: {first_name:'Scott'} })
      expect(wrapper.vm.onboarding.person).toBe(true)
    })
    it('#posts will be true when person posts', () => {
      localStorage.setItem('posts-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.posts).toBe(true)
    })
    it('#friends will be true when person adds a friend', () => {
      localStorage.setItem('friends-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.friends).toBe(true)
    })
    it('#events will be true when person has 5 friends', () => {
      localStorage.setItem('friends-count', 5)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.events).toBe(true)
    })
    it('#groups will be true when person has 25 friends', () => {
      localStorage.setItem('friends-count', 25)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.groups).toBe(true)
    })
  })

  describe('user_name()', () => {
    it('returns profile by default', () => {
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.user_name).toBe('Profile')
    })
    it('returns the users first name if set', () => {
      const wrapper = shallow(main_nav)
      wrapper.setData({ person: {first_name:'Scott'} })
      expect(wrapper.vm.user_name).toBe('Scott')
    })
  })

})
