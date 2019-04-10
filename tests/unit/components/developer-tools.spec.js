import { shallow } from 'vue-test-utils'
import tools from '@/components/developer-tools'

describe('@/components/developer-tools.js', () => {
  it('renders developer tools', () => {
    let wrapper = shallow(tools)
    expect(wrapper.element).toMatchSnapshot()
  })
})
