import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import App from '@/App'
describe('@/App.vue', () => {
  let initialize_mock
  let wrapper
  beforeEach(() => {
    initialize_mock = jest.fn()
    jest.spyOn(firebase, 'initializeApp').mockImplementation(initialize_mock)
    wrapper = shallow(App)
  })
  it('renders layout for the application', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('sets previously visited page in sessionStorage', () => {
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
  it('initialises firebase', () => {
    expect(initialize_mock).toHaveBeenCalledTimes(1)
  })
})
