import { shallow } from 'vue-test-utils'
import as_svg from '@/components/avatars/as-svg'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe ('@/components/avatars/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_svg, {
      propsData: { person }
    })
  })
  it ('Render an avatar', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
