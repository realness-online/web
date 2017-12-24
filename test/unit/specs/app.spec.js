import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import App from '@/App'

describe('App.vue', () => {
  let vm

  beforeEach(() => {
    vm = shallow(App)
  })

  it('renders layout for the application', () => {
    expect(vm.element).toMatchSnapshot()
  })

  it('creates a new post', () => {
    expect(typeof App.methods.addPost).toBe('function')
  })

  it('creates a new activity')
})
