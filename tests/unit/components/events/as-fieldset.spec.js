import { shallow } from 'vue-test-utils'
import as_fieldset from '@/components/events/as-fieldset'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_first_item(poster_html)
const author = {
  created_at: '2018-07-15T18:11:31.018Z',
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
const events = [{
  id: new Date(2020, 1, 1).getTime(),
  url: poster.id
}]
describe('@/compontent/events/as-fieldset.vue', () => {
  let wrapper
  beforeEach(() => wrapper = shallow(as_fieldset, { propsData: { itemid: poster.id } }))
  describe.only('Renders', () => {
    it('a fieldset', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('methods:', () => {
    describe('#manage_event', () => {
      it('is called when the calender button is pressed', async () => {
        const spy = jest.fn()
        wrapper.vm.manage_event = spy
        wrapper.vm.menu = true
        expect(wrapper.vm.show_date_picker).toBe(true)
        await wrapper.vm.$nextTick()
        wrapper.find('figcaption > input').trigger('click')
        expect(spy).toBeCalled()
      })
      it('displays the event', () => {
        wrapper.vm.manage_event()
        expect(wrapper.vm.show_date_picker).toBe(true)
        expect(wrapper.vm.selecting['selecting-date']).toBe(true)
      })
      it('hides the menu', () => {
        wrapper.vm.manage_event()
        expect(wrapper.vm.menu).toBe(false)
      })
    })
    describe('#remove_event', () => {
      it('Is called when the remove button is pressed', async () => {
        const spy = jest.fn()
        wrapper.vm.remove_event = spy
        wrapper.vm.show_event = true
        expect(wrapper.vm.show_date_picker).toBe(true)
        await wrapper.vm.$nextTick()
        wrapper.find('fieldset > menu > a:first-of-type').trigger('click')
        expect(spy).toBeCalled()
      })
      it('Emits an event to remove the event', () => {
        wrapper.vm.remove_event()
        expect(wrapper.emitted('remove-event')).toBeTruthy()
        expect(wrapper.vm.has_event).toBeFalsy()
      })
      it('Locally turns the event off', () => {
        wrapper.vm.remove_event()
        expect(wrapper.emitted('remove-event')).toBeTruthy()
        expect(wrapper.vm.has_event).toBeFalsy()
      })
    })
    describe('#save_event', () => {
      it('is called when save event button is pressed', async () => {
        const spy = jest.fn()
        wrapper.vm.save_event = spy
        wrapper.vm.show_event = true
        expect(wrapper.vm.show_date_picker).toBe(true)
        await wrapper.vm.$nextTick()
        wrapper.find('fieldset > menu > a:last-of-type').trigger('click')
        expect(spy).toBeCalled()
      })
      it('emits a save-event', () => {
        wrapper.vm.save_event()
        expect(wrapper.vm.show_event).toBe(false)
        expect(wrapper.vm.menu).toBe(true)
        expect(wrapper.emitted('add-event')).toBeTruthy()
      })
      it('emits a remove-event if poster already has event', () => {
        wrapper.setProps({ events })
        wrapper.vm.save_event()
        expect(wrapper.vm.show_event).toBe(false)
        expect(wrapper.vm.menu).toBe(true)
        expect(wrapper.emitted('remove-event')).toBeTruthy()
      })
      it('hides date picking ui', () => {
        wrapper.vm.show_event = true
        wrapper.vm.save_event()
        expect(wrapper.vm.show_event).toBe(false)
      })
      it('shows the menu', () => {
        wrapper.vm.menu = false
        wrapper.vm.save_event()
        expect(wrapper.vm.menu).toBe(true)
      })
    })
    describe('#update_date', () => {
      it('updates date from picker', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.day.value = '02-01-2020'
        wrapper.vm.update_date()
      })
    })
    describe('#update_time', () => {
      it('updates event time from time picer', async () => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.time.value = '02:03'
        wrapper.vm.update_time()
      })
    })
  })
})
