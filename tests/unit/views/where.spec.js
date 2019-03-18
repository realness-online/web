import { shallow } from 'vue-test-utils'
import where from '@/views/Where'
describe('@/views/Where.vue', () => {
  it('renders layout for location', () => {
    let wrapper = shallow(where)
    expect(wrapper.element).toMatchSnapshot()
  })
})
