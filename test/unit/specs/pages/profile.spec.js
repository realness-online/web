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
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('#get_url', () => {
    expect.assertions(1)
    const $route = {
      params: {}
    }
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    wrapper.vm.get_url('4151231234', 'posts').then(url => {
      expect(url).toBe('https://download_url/people/+14151231234/posts.html')
    })
  })
  it('#get_items', () => {
    expect.assertions(1)
    const $route = {
      params: {}
    }
    let wrapper = shallow(profile, {
      mocks: {
        $route
      }
    })
    wrapper.vm.get_items('4151231234', 'posts').then(items => {
      expect(items).toEqual([])
    })
  })
})
