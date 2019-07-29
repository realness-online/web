import { shallow } from 'vue-test-utils'
import Index from '@/views/Index'
describe('@/views/Index.vue', () => {
  it('Renders navigation for the application', () => {
    let wrapper = shallow(Index)
    expect(wrapper.element).toMatchSnapshot()
  })
})
