import { shallowMount } from '@vue/test-utils'
import * as itemid from '@/helpers/itemid'
import vector_mock from './mixin_mock'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  avatar: '/+14151234356/avatars/1578929551564'
}

describe('@/mixins/visit', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(vector_mock)
  })
  describe('methods', () => {
    describe('#visit', () => {
      it('Exists', () => {
        expect(wrapper.vm.update_visit).toBeDefined()
      })
      it('updates the user with a visit', async () => {
        const load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(person))
        await wrapper.vm.update_visit({ phoneNumber: '+16282281824' })
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Does nothing unless there is a person', async () => {
        const load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(null))
        await wrapper.vm.update_visit({ phoneNumber: '+16282281824' })
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
  })
})
