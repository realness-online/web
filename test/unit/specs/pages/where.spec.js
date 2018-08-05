import { shallow } from 'vue-test-utils'
import groups from '@/pages/where'

describe('@/pages/where.vue', () => {
  it('renders group layout', () => {
    let wrapper = shallow(groups)
    expect(wrapper.element).toMatchSnapshot()
  })
})
