import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import main_nav from '@/components/main-nav'

describe('posts-list.vue', () => {

  it('should render the application navigation', () => {
    let wrapper = shallow(main_nav)
    expect(wrapper.element).toMatchSnapshot()
  })

})
