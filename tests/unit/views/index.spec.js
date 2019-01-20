import { shallow } from 'vue-test-utils'
import index from '@/views/index'

describe('@/views/index.vue', () => {
  it('renders navigation for the application', () => {
    let wrapper = shallow(index)
    expect(wrapper.element).toMatchSnapshot()
  })
})
