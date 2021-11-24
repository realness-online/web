import { shallowMount } from '@vue/test-utils'
import * as itemid from '@/use/itemid'
import firebase from 'firebase/app'
import 'firebase/auth'
import vector_mock from './mixin_mock'
import flushPromises from 'flush-promises'
const current_user = { phoneNumber: '+16282281824' }
describe('@/mixins/visit', () => {
  let wrapper
  let person
  beforeEach(() => {
    firebase.user = current_user
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+14151234356',
      avatar: '/+14151234356/avatars/1578929551564',
      visited: '2021-02-04T18:30:01.038Z'
    }
    wrapper = shallowMount(vector_mock)
  })
  afterEach(() => {
    firebase.user = null
  })
  describe('methods', () => {
    describe('#visit', () => {
      it('Exists', () => {
        expect(wrapper.vm.update_visit).toBeDefined()
      })
      it('Updates the user with a visit', async () => {
        const load_spy = jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Does nothing unless there is a person', async () => {
        const load_spy = jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
      it('Waits a proper interval before update to visit', async () => {
        person.visited = new Date().toISOString()
        const load_spy = jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
  })
})
