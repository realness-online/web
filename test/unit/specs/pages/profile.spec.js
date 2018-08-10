import { shallow } from 'vue-test-utils'
import profile from '@/pages/profile'

describe('@/pages/profile.vue', () => {
  it('shows the users profile information', () => {
    const $route = {
        params: {
          mobile: '4151231234'
        }
    }
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
})
