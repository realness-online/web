import { shallow } from 'vue-test-utils'
import as_figure from '@/components/posters/as-figure'
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
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => wrapper = shallow(as_figure, { propsData: { itemid: poster.id } }))
  describe('Renders', () => {
    it('a poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('a new poster', () => {
      wrapper = shallow(as_figure, { propsData: { new_poster: poster, is_new: true } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('methods:', () => {
    describe('#vector_click', () => {
      it('Shows the menu', () => {
        const svg = wrapper.find('figure > svg')
        expect(wrapper.vm.menu).toBe(false)
        expect(wrapper.vm.show_event).toBe(false)
        wrapper.vm.vector_click(true)
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Doesn/t show the menu if the event selection has focus', () => {
        expect(wrapper.vm.menu).toBe(false)
        wrapper.vm.show_event = true
        expect(wrapper.vm.show_event).toBe(true)
        wrapper.vm.vector_click()
        expect(wrapper.vm.menu).toBe(false)
      })
    })
    describe('#remove_poster', () => {
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
  })
  describe('computed:', () => {
    describe('show_date_picker', () => {
      it('is false by default', () => {
        expect(wrapper.vm.show_date_picker).toBe(false)
      })
      it('is true when menu is visible', () => {
        expect(wrapper.vm.show_date_picker).toBe(false)
        wrapper.vm.menu = true
        expect(wrapper.vm.show_date_picker).toBe(true)
      })
      it('is false when menu is gone', () => {
        wrapper.vm.menu = true
        expect(wrapper.vm.show_date_picker).toBe(true)
        wrapper.vm.menu = false
        expect(wrapper.vm.show_date_picker).toBe(false)
      })
      it ('is true when show_event is true', () => {
        expect(wrapper.vm.show_date_picker).toBe(false)
        wrapper.vm.show_event = true
        expect(wrapper.vm.show_date_picker).toBe(true)
      })
    })
  })
})
