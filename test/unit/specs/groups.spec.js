import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import groups from '@/groups'

describe('index.vue', () => {
  it('renders group layout', () => {
    let wrapper = shallow(groups)
    expect(wrapper.element).toMatchSnapshot()
  })
})
