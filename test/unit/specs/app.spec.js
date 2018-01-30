import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import App from '@/App'

describe('App.vue', () => {
  it('renders layout for the application', () => {
    let wrapper = shallow(App)
    expect(wrapper.element).toMatchSnapshot()
  })
})
