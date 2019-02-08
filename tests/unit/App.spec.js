import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import App from '@/App'
describe('@/App.vue', () => {
  it('renders layout for the application', () => {
    let wrapper = shallow(App)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('sets previously visited page in sessionStorage', () => {
    const $route = {
      path: '/relations'
    }
    let wrapper = shallow(App, {
      mocks: {
        $route
      }
    })
    wrapper.setData({ $route: { path: '/magic' } })
    expect(sessionStorage.previous).toBe('/relations')
  })
  it('initialises firebase')
})
