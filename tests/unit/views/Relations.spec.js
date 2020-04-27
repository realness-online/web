import { shallow } from 'vue-test-utils'
import Relations from '@/views/Relations'
import itemid from '@/helpers/itemid'
import { Relations as buddies } from '@/persistance/Storage'
describe ('@/views/Relations.vue', () => {
  const me = {
    id: "/+16282281824",
    type: "person"
  }
  const joe_friday = {
    id: '/+14151234356',
    type: 'person',
    first_name: 'Joe',
    last_name: 'Friday'
  }
  it ('Render relationship information', async () => {
    const my = {
      id: "/+16282281824/relations",
      type: "relations",
      relations: [{ id: '/+14151234356' }]
    }
    const load_relations = jest.spyOn(itemid, 'load')
                          .mockImplementationOnce(() => Promise.resolve(my))
    const load_profile = jest.spyOn(itemid, 'load')
                         .mockImplementationOnce(() => Promise.resolve(joe_friday))
    const wrapper = await shallow(Relations)
    expect(wrapper.vm.relations.length).toBe(1)
    expect(load_relations).toBeCalled()
    expect(load_profile).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
