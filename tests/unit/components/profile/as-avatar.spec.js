import { shallow } from 'vue-test-utils'
import as_avatar from '@/components/profile/as-avatar'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/components/profile/as-avatar.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_avatar, {
      propsData: { person }
    })
  })
  it('Render an avatar', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
