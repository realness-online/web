import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import nav from '@/components/nav'

describe('posts-list.vue', () => {

  it('should render the application navigation', () => {
    let wrapper = shallow(nav)
    expect(wrapper.element).toMatchSnapshot()
  })

})
