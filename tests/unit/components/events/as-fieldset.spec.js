import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import as_fieldset from '@/components/events/as-fieldset'
import itemid from '@/helpers/itemid'
import get_item from '@/modules/item'

const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
const MockDate = require('mockdate')
MockDate.set('2020-01-01', new Date().getTimezoneOffset())
const events = [{
  id: `/+16282281824/events/${new Date(2020, 1, 1).getTime()}`,
  url: poster.id
}]
describe('@/compontent/events/as-fieldset.vue', () => {
  beforeEach(() => {
    get.mockImplementation(_ => Promise.resolve({}))
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
      jest.spyOn(itemid, 'list').mockImplementationOnce(_ => events)
      wrapper = shallowMount(as_fieldset, { propsData: { itemid: poster.id } })
    })
    describe('#show_picker', () => {
      it('Ideas called when the date input is clicked', () => {
        wrapper.vm.show = false
        wrapper.vm.$refs.day.click()
        expect(wrapper.vm.show).toBe(true)
      })
      it('Shows the picker', () => {
        wrapper.vm.show = false
        wrapper.vm.show_picker()
        expect(wrapper.vm.show).toBe(true)
      })
      it('Tells the world it is showing the picker', () => {
        wrapper.vm.show_picker()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
    })
    describe('#save', () => {
      it('Is called when save button is pressed', () => {
        wrapper.vm.show = true
        wrapper.vm.$refs.save.click()
        expect(wrapper.vm.show).toBe(false)
      })
      it('Emits a picker event', async () => {
        await wrapper.vm.save()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
      it('Removes any existing events', () => {
        expect(wrapper.vm.events.length).toBe(1)
        wrapper.vm.save()
        expect(wrapper.vm.events.length).toBe(1)
      })
      it('Hides date picking ui', () => {
        wrapper.vm.show = true
        wrapper.vm.save()
        expect(wrapper.vm.show).toBe(false)
      })
    })
    describe('#remove', () => {
      it('Hides the picker', async () => {
        wrapper.vm.show = true
        wrapper.vm.$refs.remove.click()
        expect(wrapper.vm.show).toBe(false)
      })
      it('Emits an event to remove the event', async () => {
        await wrapper.vm.remove()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
      it('Removes the event', () => {
        expect(wrapper.vm.events.length).toBe(1)
        wrapper.vm.remove()
        expect(wrapper.vm.events.length).toBe(0)
      })
    })
    describe('#update_date', () => {
      it('Updates date from picker', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.day.value = '02-01-2020'
        wrapper.vm.update_date()
      })
    })
    describe('#update_time', () => {
      it('Updates event time from time picer', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.time.value = '02:03'
        wrapper.vm.update_time()
      })
    })
  })
})
