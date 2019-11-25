import { shallow } from 'vue-test-utils'
import Relations from '@/views/Relations'
import profile from '@/helpers/profile'
import { relations_storage } from '@/storage/Storage'
describe('@/views/Relations.vue', () => {
  const person = {
    id: '/+14151234356',
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  it('Render relationship information', () => {
    const relations_spy = jest.spyOn(relations_storage, 'as_list')
    .mockImplementation(() => [person])
    const spy = jest.spyOn(profile, 'load')
    .mockImplementation(() => Promise.resolve(person))
    let wrapper = shallow(Relations)
    expect(wrapper.vm.relations.length).toBe(1)
    expect(spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
