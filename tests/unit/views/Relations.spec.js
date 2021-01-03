import { shallowMount } from '@vue/test-utils'
import Relations from '@/views/Relations'
import * as itemid from '@/helpers/itemid'
describe('@/views/Relations.vue', () => {
  const joe_friday = {
    id: '/+14151234356',
    type: 'person',
    first_name: 'Joe',
    last_name: 'Friday'
  }
  it('Render relationship information', async () => {
    const my = {
      id: '/+16282281824/relations',
      type: 'relations',
      relations: [{ id: '/+14151234356' }]
    }
    const load_relations = jest.spyOn(itemid, 'list')
                          .mockImplementation(_ => Promise.resolve(my.relations))
    const load_profile = jest.spyOn(itemid, 'load')
                         .mockImplementation(_ => Promise.resolve(joe_friday))
    const wrapper = await shallowMount(Relations, {
      stubs: ['router-link', 'router-view']
    })
    expect(wrapper.vm.relations.length).toBe(1)
    expect(load_relations).toBeCalled()
    expect(load_profile).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
