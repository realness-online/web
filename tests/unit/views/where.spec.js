import { shallow } from 'vue-test-utils'
import groups from '@/views/Where'
describe('@/views/where.vue', () => {
  it('renders layout for location', () => {
    let wrapper = shallow(groups)
    expect(wrapper.element).toMatchSnapshot()
  })
})
