import { shallow } from 'vue-test-utils'
import index from '@/pages/index'

describe('@/pages/index.vue', () => {
  it('renders navigation for the application', () => {
    let wrapper = shallow(index)
    expect(wrapper.element).toMatchSnapshot()
  })
})
