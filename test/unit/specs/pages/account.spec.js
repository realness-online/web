import { shallow } from 'vue-test-utils'
import account from '@/pages/account'

describe('@/pages/account.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(account)
    expect(wrapper.element).toMatchSnapshot()
  })
})
