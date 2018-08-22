import { shallow } from 'vue-test-utils'
import application from '@/components/application'

const signed_out = jest.fn(state_changed => state_changed())
const signed_in = jest.fn((state_changed) => { state_changed({user: {} }) })
describe('@/components/application.vue', () => {

  it('renders layout for the application', () => {
    let wrapper = shallow(application)
    expect(wrapper.element).toMatchSnapshot()
  })

  it('only syncs data for people who are signed in', () => {
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
