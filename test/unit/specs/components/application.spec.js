import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import application from '@/components/application'

describe('application.vue', () => {
  it('renders layout for the application', () => {
    let wrapper = shallow(application)
    expect(wrapper.element).toMatchSnapshot()
  })
})
