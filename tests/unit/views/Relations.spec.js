import { shallow } from 'vue-test-utils'
import Relations from '@/views/Relations'
import profile_id from '@/helpers/profile'
describe('@/views/Relations.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  beforeEach(() => {
    wrapper = shallow(Relations)
  })
  it('Render relationship information', () => {
    wrapper.setData({ relations: [person] })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Should emit an add-relationship event', () => {
    expect(wrapper.vm.relations.length).toBe(0)
    wrapper.vm.$emit('add-relationship', person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('Should respond to a remove-relationship event', () => {
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$emit('remove-relationship', person)
    expect(wrapper.vm.relations.length).toBe(0)
  })
  it('Remove-relationship should only remove the person provided', () => {
    const other_person = {
      id: '/+12223334444',
      first_name: 'Katie',
      last_name: 'Caffey',
      mobile: '2223334444'
    }
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$emit('remove-relationship', other_person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('#fill_in_relationships', () => {
    const load_spy = jest.spyOn(profile_id, 'load')
    .mockImplementation(() => Promise.resolve(person))
    wrapper.setData({ relations: [person] })
    wrapper.vm.fill_in_relationships()
    expect(load_spy).toBeCalled()
  })
})
