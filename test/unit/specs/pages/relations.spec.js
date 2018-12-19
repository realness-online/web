import { shallow } from 'vue-test-utils'
import relations from '@/pages/relations'

describe('@/pages/relations.vue', () => {
  let wrapper
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  beforeEach(() => {
    wrapper = shallow(relations)
  })
  it('render relationship information', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should emit an add-relationship event', () => {
    expect(wrapper.vm.relations.length).toBe(0)
    wrapper.vm.$bus.$emit('add-relationship', person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
  it('should respond to a remove-relationship event', () => {
    wrapper.setData({relations: [person]})
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
    wrapper.setData({relations: [person]})
    expect(wrapper.vm.relations.length).toBe(1)
    wrapper.vm.$bus.$emit('remove-relationship', other_person)
    expect(wrapper.vm.relations.length).toBe(1)
  })
})
