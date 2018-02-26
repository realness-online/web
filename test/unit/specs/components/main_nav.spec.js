import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'

describe('posts-list.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(main_nav)
  })

  it('should render the application navigation', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('should only display textarea when user first visits')
  it('should display feed link after user has created a post')

  describe('nav > a[href=profile]', () => {
    it ("should render a person's first name", () => {

    })

    it('should render a profile picture')
  })

})
