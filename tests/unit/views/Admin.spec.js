import { shallow } from 'vue-test-utils'
import Admin from '@/views/Admin'
describe('@/views/Admin.vue', () => {
  it('Renders list of upcoming events', () => {
    const wrapper = shallow(Admin)
    expect(wrapper.element).toMatchSnapshot()
  })
})
