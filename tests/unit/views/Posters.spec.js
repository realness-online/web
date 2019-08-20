import { shallow } from 'vue-test-utils'
import Posters from '@/views/Posters'
describe('@/views/Posters.vue', () => {
  it('Renders layout for posters', () => {
    let wrapper = shallow(Posters)
    expect(wrapper.element).toMatchSnapshot()
  })
})
