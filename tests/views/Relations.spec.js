import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Relations from '@/views/Relations'
import * as itemid from '@/use/itemid'
describe('@/views/Relations.vue', () => {
  describe('Renders', () => {
    it('Relationship information', async () => {
      const my = {
        id: '/+16282281824/relations',
        type: 'relations',
        relations: [{ id: '/+14151234356' }]
      }
      const load_relations = vi
        .spyOn(itemid, 'list')
        .mockImplementation(() => Promise.resolve(my.relations))
      const wrapper = mount(Relations, {
        global: { stubs: ['router-link'] }
      })
      await flushPromises()

      expect(load_relations).toBeCalled()
      expect(wrapper.vm.relations.length).toBe(1)
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Fails gracefully when relations has been deleted', async () => {
      const load_relations = vi
        .spyOn(itemid, 'list')
        .mockImplementation(() => Promise.resolve([]))
      const wrapper = mount(Relations, {
        global: { stubs: ['router-link'] }
      })
      await flushPromises()
      expect(wrapper.vm.relations.length).toBe(0)
      expect(load_relations).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
