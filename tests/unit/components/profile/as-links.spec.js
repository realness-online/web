import { shallow } from 'vue-test-utils'
import as_links from '@/components/profile/as-links'
describe('@/compontent/profile/as-links.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356',
    avatar: 'avatars/5553338945763'
  }
  beforeEach(() => {
    wrapper = shallow(as_links, { propsData: { people: [person] } })
  })
  it('Renders a list of the person relationships', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
