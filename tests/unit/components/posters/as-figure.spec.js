import { shallowMount } from '@vue/test-utils'
import as_figure from '@/components/posters/as-figure'
import get_item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_figure, { propsData: { itemid: poster.id } })
  })
  describe('renders:', () => {
    it('A poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A new poster', async () => {
      await wrapper.setProps({ new_poster: poster })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('computed:', () => {
    describe('background', () => {
      it('Returns background when figure is working', () => {
        wrapper.setProps({ working: true })
        expect(wrapper.vm.background).toBe('working')
      })
    })
    describe('date_picker', () => {
      it('Is false by default', () => {
        expect(wrapper.vm.date_picker).toBe(false)
      })
      it('Is true when menu is visible', () => {
        expect(wrapper.vm.date_picker).toBe(false)
        wrapper.vm.menu = true
        expect(wrapper.vm.date_picker).toBe(true)
      })
      it('Is false when menu is gone', () => {
        wrapper.vm.menu = true
        expect(wrapper.vm.date_picker).toBe(true)
        wrapper.vm.menu = false
        expect(wrapper.vm.date_picker).toBe(false)
      })
      it('Is true when selecting_event', () => {
        expect(wrapper.vm.date_picker).toBe(false)
        wrapper.vm.selecting_event = true
        expect(wrapper.vm.date_picker).toBe(true)
      })
    })
  })
  describe('watch', () => {
    describe('new_poster', () => {
      it('Sets poster to new_poster', async () => {
        expect(wrapper.vm.menu).toBe(false)
        const new_poster = { ...poster }
        new_poster.id = 'new_id'
        await wrapper.setProps({ new_poster })
        expect(wrapper.vm.poster.id).toBe('new_id')
      })
      it('Sets menu to true', async () => {
        expect(wrapper.vm.menu).toBe(false)
        const new_poster = { ...poster }
        await wrapper.setProps({ new_poster })
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Leaves poster alone when null', async () => {
        wrapper = shallowMount(as_figure, {
          propsData: {
            itemid: poster.id,
            new_poster: poster
          }
        })
        wrapper.vm.poster = poster
        await wrapper.setProps({ new_poster: null })
        expect(wrapper.vm.new_poster).toBe(null)
        expect(wrapper.vm.poster.id).toBe(poster.id)
      })
    })
  })
  describe('methods:', () => {
    describe('#on_load', () => {
      it('Sets loaded to true', () => {
        wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
      })
      it('Emits an event after rendering svg', () => {
        wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
        expect(wrapper.emitted('loaded')).toBeTruthy()
      })
    })
    describe('#vector_click', () => {
      it('Shows the menu', () => {
        expect(wrapper.vm.menu).toBe(false)
        expect(wrapper.vm.selecting_event).toBe(false)
        wrapper.vm.vector_click(true)
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Doesn/t show the menu if the event selection has focus', () => {
        expect(wrapper.vm.menu).toBe(false)
        wrapper.vm.selecting_event = true
        wrapper.vm.vector_click()
        expect(wrapper.vm.menu).toBe(false)
      })
    })
    describe('#add_poster', () => {
      it('Emits add-poster when called', () => {
        wrapper.vm.add_poster()
        expect(wrapper.emitted('add-poster')).toBeTruthy()
      })
      it('Gets rid of all the extra html it can before saving', () => {
        wrapper.vm.selecting_event = true
        wrapper.vm.menu = true
        expect(wrapper.vm.date_picker).toBe(true)
        wrapper.vm.add_poster()
        expect(wrapper.vm.selecting_event).toBe(false)
        expect(wrapper.vm.menu).toBe(false)
        expect(wrapper.vm.date_picker).toBe(false)
      })
    })
    describe('#remove_poster', () => {
      it('Triggers a confirm message before deleting poster', () => {
        const confirm_spy = jest.fn(() => true)
        window.confirm = confirm_spy
        wrapper.vm.remove_poster()
        expect(confirm_spy).toBeCalled()
        expect(wrapper.emitted('remove-poster')).toBeTruthy()
      })
      it('Will not emit remove-poster unless confirmed', () => {
        const confirm_spy = jest.fn(() => false)
        window.confirm = confirm_spy
        wrapper.vm.remove_poster()
        expect(confirm_spy).toBeCalled()
        expect(wrapper.emitted('remove-poster')).toBeFalsy()
      })
    })
    describe('#event_picker', () => {
      describe('true', () => {
        beforeEach(() => {
          wrapper.vm.event_picker(true)
        })
        it('Hides the normal', () => {
          expect(wrapper.vm.menu).toBe(false)
        })
        it('Shows the event picker', () => {
          expect(wrapper.vm.selecting_event).toBe(true)
        })
      })
      describe('false', () => {
        beforeEach(() => {
          wrapper.vm.event_picker(false)
        })
        it('Shows the normal', () => {
          expect(wrapper.vm.menu).toBe(true)
        })
        it('Hides the event picker', () => {
          expect(wrapper.vm.selecting_event).toBe(false)
        })
      })
    })
  })
})
