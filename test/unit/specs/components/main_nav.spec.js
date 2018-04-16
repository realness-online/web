import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'

describe('main-nav.vue', () => {
  // TODO: add test to confirm that buttons show up after user posts
  describe('nav#main_nav', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(main_nav)
    })
    it('#show:true should render the application navigation', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('#show:false should Hide navigation', () => {
      wrapper.setData({ show: false })
      expect(wrapper.element).toMatchSnapshot()
    })
    it("post-added event should set posts to true", () => {
      wrapper.vm.$bus.$emit('post-added')
      expect(wrapper.vm.has_posts).toBe(true)
    })
  })

  describe('onBoarding()', () => {

    it('all onboarding is off at first', () => {
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.has_posts).toBe(false)
      expect(wrapper.vm.onboarding.is_person).toBe(false)
      expect(wrapper.vm.onboarding.has_friends).toBe(false)
      expect(wrapper.vm.onboarding.can_event).toBe(false)
      expect(wrapper.vm.onboarding.can_group).toBe(false)
    })
    it('#person is true when person has profile info', () => {
      const wrapper = shallow(main_nav)
      wrapper.setData({ person: {first_name:'Scott'} })
      expect(wrapper.vm.onboarding.is_person).toBe(true)
    })
    it('#posts will be true when person posts', () => {
      localStorage.setItem('posts-count', 1)
      const wrapper = shallow(main_nav)
      expect(wrapper.vm.onboarding.has_posts).toBe(true)
    })
    it('#friends will be true when person adds a friend', () => {
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
    let wrapper
    beforeEach(() => {
      wrapper = shallow(main_nav)
    })
    it('returns profile by default', () => {
      expect(wrapper.vm.user_name).toBe('Profile')
    })
    it('returns the users first name if set', () => {
      wrapper.setData({ person: {first_name:'Scott'} })
      expect(wrapper.vm.user_name).toBe('Scott')
    })
  })

})
