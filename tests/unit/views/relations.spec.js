import { shallow } from 'vue-test-utils'
import relations from '@/views/Relations'
import profile from '@/modules/Profile'
describe('@/views/Relations.vue', () => {
  let wrapper
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  beforeEach(() => {
    wrapper = shallow(relations)
  })
  it('render relationship information', () => {
    wrapper.setData({ relations: [person] })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should emit an add-relationship event', () => {
    expect(wrapper.vm.relations.length).toBe(0)
    wrapper.vm.$bus.$emit('add-relationship', person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('should respond to a remove-relationship event', () => {
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$bus.$emit('remove-relationship', person)
    expect(wrapper.vm.relations.length).toBe(0)
  })
  it('remove-relationship should only remove the person provided', () => {
    const other_person = {
      id: '/+12223334444',
      first_name: 'Katie',
      last_name: 'Caffey',
      mobile: '2223334444'
    }
    wrapper.setData({ relations: [person] })
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$bus.$emit('remove-relationship', other_person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('fill_in_relationships()', () => {
    const load_spy = jest.fn(() => Promise.resolve('load_spy'))
    jest.spyOn(profile, 'load').mockImplementation(() => Promise.resolve(person))
    wrapper.setData({ relations: [person] })
    wrapper.vm.fill_in_relationships().then(() => {
      expect(load_spy).toBeCalled()
    })
  })
})
