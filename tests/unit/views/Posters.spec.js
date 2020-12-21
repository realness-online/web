import { shallowMount } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/modules/item'
import itemid from '@/helpers/itemid'
import { get } from 'idb-keyval'
import { Poster } from '@/persistance/Storage'
const poster_html = require('fs').readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)

const events = [{
  id: new Date(2020, 1, 1).getTime(),
  poster: poster.id
}]

describe('@/views/Posters.vue', () => {
  let wrapper
  beforeEach(() => {
    get.mockImplementation(_ => Promise.resolve({ items: ['1555347888'] }))
    wrapper = shallowMount(Posters)
    wrapper.vm.events = events
  })
  describe('rendering:', () => {
    it('Renders UI for posters', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Unmounts the worker when destroyed', () => {
      const mock = jest.fn()
      wrapper.vm.vectorizer = { terminate: mock }
      wrapper.vm.optimizer = { terminate: mock }
      wrapper.destroy()
      expect(mock).toHaveBeenCalledTimes(2)
    })
  })
  describe('computed', () => {
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
    describe('as_itemid', () => {
      wrapper = shallowMount(Posters)
      localStorage.me = '/+16282281824'
      wrapper.vm.new_poster = { created_at: 'now' }
      expect(wrapper.vm.as_itemid).toBe('/+16282281824/posters/now')
    })
  })
  describe('methods:', () => {
    describe('get_id', () => {
      it('Gets the poster id from the directory listing on hte network', () => {
        wrapper.vm.get_id(`${poster.id}.html`)
      })
    })
    describe('#vectorize', () => {
      it('Executes the method', () => {
        wrapper.vm.vectorize()
      })
    })
    describe('#vectorized', () => {
      it('Gets the poster from the worker', () => {
        const event = {
          data: poster
        }
        wrapper.vm.vectorized(event)
        expect(wrapper.vm.new_poster.id).toBe(poster.id)
      })
    })
    describe('#optimize', () => {
      it('Gives the optimize worker a vector to work on', () => {
        wrapper.vm.optimizer.postMessage = jest.fn()
        wrapper.vm.optimize({ id: 'mock-vector' })
        expect(wrapper.vm.optimizer.postMessage).toBeCalled()
      })
    })
    describe('#optimized', () => {
      it('Updates new_poster with the optimized vector', async () => {
        wrapper.vm.working = true
        await wrapper.vm.optimized({ data: { vector: poster_html } })
        expect(wrapper.vm.working).toBe(false)
        expect(wrapper.vm.new_poster.id).toBe('/+16282281824/posters/559666932867')
      })
    })
    describe('#get_poster_list', () => {
      it('Adds posters', async () => {
        jest.spyOn(itemid, 'as_directory').mockImplementationOnce(_ => {
            return { items: ['1576588885385'] }
        })
        await wrapper.vm.get_poster_list({})
        expect(wrapper.vm.posters.length).toBe(1)
      })
      it('Handles an empty poster list', async () => {
        jest.spyOn(itemid, 'as_directory').mockImplementationOnce(_ => null)
        await wrapper.vm.get_poster_list({})
      })
    })
    describe('#cancel_poster', () => {
      it('Executes the method', () => {
        wrapper.vm.cancel_poster(poster.id)
      })
    })
    describe('#save_poster', () => {
      it('Executes the method', async () => {
        await wrapper.vm.save_poster(poster.id)
      })
    })
    describe('#remove_poster', () => {
      let confirm_spy
      let delete_spy
      beforeEach(() => {
        confirm_spy = jest.fn(() => true)
        delete_spy = jest.fn(() => Promise.resolve())
        window.confirm = confirm_spy
        jest.spyOn(Poster.prototype, 'delete').mockImplementation(delete_spy)
      })
      it('Executes the method', async () => {
        await wrapper.vm.remove_poster(poster.id)
        expect(delete_spy).toBeCalled()
      })
      it('Triggers a confirm message before deleting poster', async () => {
        await wrapper.vm.remove_poster(poster.id)
        expect(confirm_spy).toBeCalled()
      })
      it('Will not delete poster unless confirmed', async () => {
        confirm_spy.mockImplementationOnce(() => false)
        await wrapper.vm.remove_poster(poster.id)
        expect(confirm_spy).toBeCalled()
        expect(delete_spy).not.toBeCalled()
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
