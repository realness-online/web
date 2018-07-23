import {shallow} from 'vue-test-utils'
import as_list from '@/components/profile/as-list'
describe('@/compontent/profile/as-list.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_list)
  })
  it('should render a list of people', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  
})
