import { shallow } from 'vue-test-utils'
import as_list from '@/components/profile/as-list'
describe('@/compontent/profile/as-list.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  beforeEach(() => {
    wrapper = shallow(as_list, { propsData: { people: [] } })
  })
  it('Render a list of people', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Should emit an add event', () => {
    expect(wrapper.vm.relations.length).toBe(0)
    wrapper.vm.add_relationship(person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('Should respond to a remove event', () => {
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.remove_relationship(person)
    expect(wrapper.vm.relations.length).toBe(0)
  })
  it('Remove event should only remove the person provided', () => {
    const other_person = {
      id: '/+12223334444',
      first_name: 'Katie',
      last_name: 'Caffey',
      mobile: '2223334444'
    }
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$emit('remove', other_person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
})
