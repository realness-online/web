import { shallow } from 'vue-test-utils'
import as_hgroup from '@/components/profile/as-hgroup'
describe ('@/compontent/profile/as-hgroup.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356',
    avatar: 'avatars/5553338945763'
  }
  beforeEach(() => {
    wrapper = shallow(as_hgroup, { propsData: { person } })
  })
  it ('Renders a person as a hgroup element', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
