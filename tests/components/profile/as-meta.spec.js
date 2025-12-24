import { shallowMount } from '@vue/test-utils'
import as_meta from '@/components/profile/as-meta'
describe('@/component/profile/as-meta.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    name: 'Scott Fryxell',
    mobile: '4151234356',
    avatar: 'avatars/5553338945763'
  }
  beforeEach(() => {
    localStorage.me = person.id
    wrapper = shallowMount(as_meta, { props: { people: [person] } })
  })
  afterEach(() => {
    localStorage.clear()
  })
  describe('Renders', () => {
    it('A list of the person relationships', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
