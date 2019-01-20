import { shallow } from 'vue-test-utils'
import account from '@/views/account'

describe('@/views/account.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(account)
    expect(wrapper.element).toMatchSnapshot()
  })
})
