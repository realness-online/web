
import { shallow } from 'vue-test-utils'
import as_figure from '@/components/posters/as-figure'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_items(poster_html)[0]
const author = {
  created_at: '2018-07-15T18:11:31.018Z',
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281823'
}
const events = [{
  id: new Date(2020, 1, 1).getTime(),
  poster: poster.id
}]
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => wrapper = shallow(as_figure, { propsData: { author, poster } }))
  describe('Renders', () => {
    it('a poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('a new poster', () => {
      wrapper = shallow(as_figure, { propsData: { author, poster, is_new: true } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('a poster with an event', () => {
      expect(wrapper.vm.has_event).toBe(null)
      wrapper = shallow(as_figure, { propsData: { author, poster, events } })
      expect(wrapper.vm.has_event).toBe('has-event')
    })
    it('the date-picker apropriately', () => {
      expect(wrapper.vm.show_date_picker).toBe(false)
      wrapper.vm.menu = true
      expect(wrapper.vm.show_date_picker).toBe(true)
      wrapper.vm.menu = false
      expect(wrapper.vm.show_date_picker).toBe(false)
      wrapper.vm.show_event = true
      expect(wrapper.vm.show_date_picker).toBe(true)
    })
  })
  describe('methods:', () => {
    describe('#svg_click', () => {
      it('Shows the menu', () => {
        const svg = wrapper.find('figure > svg')
        expect(wrapper.vm.menu).toBe(false)
        svg.trigger('click')
        expect(wrapper.vm.menu).toBe(true)
        expect(wrapper.find('figure > figcaption > menu').exists()).toBe(true)
      })
      it('Doesn/t show the menu if the event selection has focus', () => {
        expect(wrapper.vm.menu).toBe(false)
        wrapper.vm.show_event = true
        expect(wrapper.vm.show_event).toBe(true)
        wrapper.vm.svg_click()
        expect(wrapper.vm.menu).toBe(false)
      })
    })
    describe('#remove_poster', () => {
      it('is called when remove button is clicked', async() => {
        const remove_spy = jest.fn()
        wrapper.vm.remove_poster = remove_spy
        wrapper.vm.menu = true
        await wrapper.vm.$nextTick()
        wrapper.find('menu > a:nth-child(2)').trigger('click')
        expect(remove_spy).toBeCalled
      }),
      it('triggers a confirm message before deleting poster', () => {
        const confirm_spy = jest.fn(() => true)
        window.confirm = confirm_spy
        wrapper.vm.remove_poster()
        expect(confirm_spy).toBeCalled()
        expect(wrapper.emitted('remove-poster')).toBeTruthy()
      })
      it('will not emit remove-poster unless confirmed', () => {
        const confirm_spy = jest.fn(() => false)
        window.confirm = confirm_spy
        wrapper.vm.remove_poster()
        expect(confirm_spy).toBeCalled()
        expect(wrapper.emitted('remove-poster')).toBeFalsy()
      })
    })
    describe('#add_poster', () => {
      it('is called when the add button is pressed', async() => {
        const spy = jest.fn()
        wrapper.vm.add_poster = spy
        wrapper.vm.menu = true
        await wrapper.vm.$nextTick()
        wrapper.find('menu > a:nth-child(2)').trigger('click')
        expect(spy).not.toBeCalled()
        wrapper.vm.is_new = true
        await wrapper.vm.$nextTick()
        wrapper.find('menu > a:nth-child(2)').trigger('click')
        expect(spy).toBeCalled()
      })
      it('emits add-poster when called', () => {
        wrapper.vm.add_poster()
        expect(wrapper.emitted('add-poster')).toBeTruthy()
      })
      it('gets rid of all the extra html it can before saving', () => {
        wrapper.vm.show_event = true
        wrapper.vm.menu = true
        expect(wrapper.vm.show_date_picker).toBe(true)
        wrapper.vm.add_poster()
        expect(wrapper.vm.show_event).toBe(false)
        expect(wrapper.vm.menu).toBe(false)
        expect(wrapper.vm.show_date_picker).toBe(false)
      })
    })
    describe('#manage_event', () => {
      it('is called when the calender button is pressed', async() => {
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
      it('Is called when the remove button is pressed', async() => {
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
      it('is called when save event button is pressed', async() => {
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
      it('updates date from picker', async() => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.day.value = '02-01-2020'
        wrapper.vm.update_date()
      })
    })
    describe('#update_time', () => {
      it('updates event time from time picer', async() => {
        wrapper.vm.show_event = true
        await wrapper.vm.$nextTick()
        wrapper.vm.$refs.time.value = '02:03'
        wrapper.vm.update_time()
      })
    })
  })
})
