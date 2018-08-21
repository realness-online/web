import { shallow } from 'vue-test-utils'
import profile from '@/pages/profile'

describe('@/pages/profile.vue', () => {
  it('shows the users profile information', () => {
    const $route = {
      params: {}
    }
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('shows a phone numbers profile information', () => {
    const $route = {
      params: {
        mobile: '4151231234'
      }
    }
    profile.methods.get_items = jest.fn(() => Promise.resolve('result of confirm_spy') )
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('#get_url', () => {
  })
  it('#get_items', () => {
  })
})
