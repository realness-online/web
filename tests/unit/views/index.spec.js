import { shallow } from 'vue-test-utils'
import index from '@/views/Index'

describe('@/views/Index.vue', () => {
  it('renders navigation for the application', () => {
    let wrapper = shallow(index)
    expect(wrapper.element).toMatchSnapshot()
  })
})
