import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import as_fieldset from '@/components/events/as-fieldset'
import * as itemid from '@/helpers/itemid'
import get_item from '@/modules/item'
import flushPromises from 'flush-promises'
import firebase from 'firebase/app'
const poster_html = require('fs').readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const MockDate = require('mockdate')
MockDate.set('2020-01-01', new Date().getTimezoneOffset())
const events = [{
  when: `${new Date(2020, 1, 1).getTime()}`,
  url: poster.id
}]
const user = {
  phoneNumber: '+16282281824'
}
describe('@/compontent/events/as-fieldset.vue', () => {
  beforeEach(() => {
    firebase.user = user
    get.mockImplementation(_ => Promise.resolve({}))
    localStorage.me = '/+16282281824'
  })
  afterEach(() => {
    localStorage.clear()
    firebase.user = null
  })
  let wrapper
  describe('Renders', () => {
    it('A fieldset with the default event', () => {
      jest.spyOn(itemid, 'list').mockImplementationOnce(_ => [])
      wrapper = shallowMount(as_fieldset, { propsData: { itemid: poster.id } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A fieldset with an existing event', () => {
      jest.spyOn(itemid, 'list').mockImplementationOnce(_ => events)
      wrapper = shallowMount(as_fieldset, { propsData: { itemid: poster.id } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    beforeEach(() => {
      jest.spyOn(itemid, 'list').mockImplementation(_ => events)
      // jest.spyOn(itemid, 'list').mockImplementationOnce(_ => events)
      wrapper = shallowMount(as_fieldset, { propsData: { itemid: poster.id } })
    })
    describe('#save', () => {
      it('Emits a picker event', async () => {
        await wrapper.vm.save()
        await flushPromises()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
      it('Removes any existing events', async () => {
        expect(wrapper.vm.events.length).toBe(1)
        await wrapper.vm.save()
        await flushPromises()
        expect(wrapper.vm.events.length).toBe(1)
      })
    })
    describe('#remove', () => {
      it('Emits an event to remove the event', async () => {
        await wrapper.vm.remove()
        await flushPromises()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
      it('Removes the event', async () => {
        expect(wrapper.vm.events.length).toBe(1)
        await wrapper.vm.remove()
        await flushPromises()
        expect(wrapper.vm.events.length).toBe(0)
      })
    })
    describe('#update_date', () => {
      it('Updates date from date input', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.day.value = '02-01-2020'
        wrapper.vm.update_date()
      })
    })
    describe('#update_time', () => {
      it('Updates event time from time input', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.time.value = '02:03'
        wrapper.vm.update_time()
      })
    })
  })
})
