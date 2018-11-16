import { shallow } from 'vue-test-utils'
import application from '@/components/application'
describe('@/components/application.vue', () => {
  it('renders layout for the application', () => {
    let wrapper = shallow(application)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('sets previously visited page in sessionStorage', () => {
    const $route = {
      path: '/relations'
    }
    let wrapper = shallow(application, {
      mocks: {
        $route
      }
    })
    wrapper.setData({ $route: { path: '/magic' } })
    expect(sessionStorage.previous).toBe('/relations')
  })
})
