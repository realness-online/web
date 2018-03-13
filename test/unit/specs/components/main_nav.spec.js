import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'

describe('main-nav.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(main_nav)
    console.log(wrapper)
  })

  it('should render the application navigation', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  describe('onBoarding()', () => {
    it('should display feed link after user has created a post')
  })

  describe('user_name()', () => {
    it('nav > a[href=profile]')
    it("should render a person's first name")
    it('should render a profile picture')
  })

})
