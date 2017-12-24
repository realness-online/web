import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import App from '@/App'

describe('App.vue', () => {
  let vm

  beforeEach(() => {
    vm = shallow(App)
  })

  it('should accept input for posts', () => {
    expect(vm.element).toMatchSnapshot()
  })

  it('should contain a social network', () => {
    expect(vm.element.querySelector('#social_network')).toBeTruthy()
  })

  // it('should list posts')

})
