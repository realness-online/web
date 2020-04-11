import { shallow } from 'vue-test-utils'
import as_fieldset from '@/components/events/as-fieldset'
import { events_storage } from '@/persistance/Storage'
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
  describe('Renders', () => {
    it('a fieldset with the default event', () => {
      jest.spyOn(events_storage, 'as_list').mockImplementationOnce(() => [])
      wrapper = shallow(as_fieldset, { propsData: { itemid: poster.id } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('a fieldset with an existing event', () => {
      jest.spyOn(events_storage, 'as_list').mockImplementationOnce(() => events)
      wrapper = shallow(as_fieldset, { propsData: { itemid: poster.id } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('methods:', () => {
    beforeEach(() => {
      jest.spyOn(events_storage, 'as_list').mockImplementationOnce(() => events)
      wrapper = shallow(as_fieldset, { propsData: { itemid: poster.id } })
    })
    describe('#show_picker', () => {
      it('is called when the date input is clicked', () => {
        wrapper.vm.show = false
        wrapper.vm.$refs.day.click()
        expect(wrapper.vm.show).toBe(true)
      })
      it('shows the picker', () => {
        wrapper.vm.show = false
        wrapper.vm.show_picker()
        expect(wrapper.vm.show).toBe(true)
      }),
      it('tells the world it is showing the picker', () => {
        wrapper.vm.show_picker()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
    })
    describe('#save', () => {
      it('is called when save button is pressed', () => {
        wrapper.vm.show = true
        wrapper.vm.$refs.save.click()
        expect(wrapper.vm.show).toBe(false)
      })
      it('emits a picker event', async () => {
        await wrapper.vm.save()
        expect(wrapper.emitted('picker')).toBeTruthy()
      })
      it('removes any existing events', () => {
        expect(wrapper.vm.events.length).toBe(1)
        wrapper.vm.save()
        expect(wrapper.vm.events.length).toBe(1)
      })
      it('hides date picking ui', () => {
        wrapper.vm.show = true
        wrapper.vm.save()
        expect(wrapper.vm.show).toBe(false)
      })
    })
    describe('#remove', () => {
      it('hides the picker', async () => {
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
