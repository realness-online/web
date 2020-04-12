import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import App from '@/App'
describe('@/App.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(App)
  })
  afterEach(() => {
    firebase.initializeApp.mockClear()
  })
  it('Renders layout of the application', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Sets previously visited page in sessionStorage', () => {
    const $route = {
      path: '/relations'
    }
    wrapper = shallow(App, {
      mocks: {
        $route
      }
    })
    wrapper.setData({ $route: { path: '/magic' } })
    expect(sessionStorage.previous).toBe('/relations')
  })
  it('Initialises firebase', () => {
    expect(firebase.initializeApp).toHaveBeenCalledTimes(1)
  })
})
