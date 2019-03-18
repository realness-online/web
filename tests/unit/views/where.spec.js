import { shallow } from 'vue-test-utils'
import Where from '@/views/Where'
describe('@/views/Where.vue', () => {
  it('renders layout for location', () => {
    let wrapper = shallow(Where)
    expect(wrapper.element).toMatchSnapshot()
  })
})
