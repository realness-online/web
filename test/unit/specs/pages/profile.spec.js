import { shallow } from 'vue-test-utils'
import profile from '@/pages/profile'

describe('@/pages/profile.vue', () => {
  it('shows the users profile information', () => {
    let wrapper = shallow(profile)
    expect(wrapper.element).toMatchSnapshot()
  })
})
