import { shallow } from 'vue-test-utils'
import sign_on from '@/components/sign-on'
describe('@/components/sign-on', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(sign_on)
  })
  it('Renders sign on button', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
