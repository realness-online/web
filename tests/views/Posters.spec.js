import { shallowMount } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import { get } from 'idb-keyval'
import { Poster } from '@/persistance/Storage'
import fs from 'fs'
const poster_html = fs.readFileSync('./__mocks__/html/poster.html', 'utf8')
const MockDate = require('mockdate')
MockDate.set('2020-01-01')
let poster
let events

describe('@/views/Posters.vue', () => {
  let wrapper
  beforeEach(() => {
    poster = get_item(poster_html)
    events = [
      {
        id: new Date(2020, 1, 1).getTime(),
        poster: poster.id
      }
    ]
    localStorage.me = '/+16282281824'
    get.mockImplementation(() => Promise.resolve({ items: ['559666932867'] }))
    wrapper = shallowMount(Posters)
    wrapper.vm.events = events
  })
  afterEach(() => {
    localStorage.me = undefined
  })
  describe('Renders', () => {
    it('UI for posters', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Unmounts the worker when destroyed', async () => {
      const mock = vi.fn()
      wrapper.vm.vectorizer = { terminate: mock }
      wrapper.vm.optimizer = { terminate: mock }
      wrapper.unmount()
      expect(mock).toHaveBeenCalledTimes(2)
    })
  })
  describe('Computed', () => {
    describe('.as_itemid', () => {
      it('returns itemid for new poster', () => {
        wrapper = shallowMount(Posters)
        localStorage.me = '/+16282281824'
        expect(wrapper.vm.as_itemid).toBe('/+16282281824/posters/1577836800000')
      })
    })
  })
  describe('Methods', () => {
    describe('#get_id', () => {
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
          data: {
            vector: {
              light: {
                d: poster.light.getAttribute('d'),
                fillOpacity: '0.208'
              },
              regular: {
                d: poster.regular.getAttribute('d'),
                fillOpacity: '0.85'
              },
              bold: {
                d: poster.bold.getAttribute('d'),
                fillOpacity: '0.535'
              },
              width: poster.width,
              height: poster.height,
              viewbox: `0 0 ${poster.width} ${poster.height}`
            }
          }
        }
        wrapper.vm.working = true
        wrapper.vm.vectorized(event)
        expect(wrapper.vm.new_poster.id).toBe(
          '/+16282281824/posters/1577836800000'
        )
        expect(wrapper.vm.working).toBe(false)
      })
    })
    describe('#optimize', () => {
      it('Gives the optimize worker a vector to work on', () => {
        wrapper.vm.optimizer.postMessage = vi.fn()
        wrapper.vm.optimize({ id: 'mock-vector' })
        expect(wrapper.vm.optimizer.postMessage).toBeCalled()
      })
    })
    describe('#optimized', () => {
      it('Updates new_poster with the optimized vector', async () => {
        await wrapper.vm.optimized({ data: { vector: poster_html } })
        expect(wrapper.vm.new_poster.id).toBe(
          '/+16282281824/posters/559666932867'
        )
      })
    })
    describe('#get_poster_list', () => {
      it('Adds posters', async () => {
        vi.spyOn(itemid, 'as_directory').mockImplementation(() => {
          return { items: ['1576588885385'] }
        })
        await wrapper.vm.get_poster_list({})
        expect(wrapper.vm.posters.length).toBe(2)
      })
      it('Handles an empty poster list', async () => {
        vi.spyOn(itemid, 'as_directory').mockImplementation(() => null)
        await wrapper.vm.get_poster_list({})
      })
    })
    describe('#cancel_poster', () => {
      it('Executes the method', () => {
        wrapper.vm.cancel_poster(poster.id)
      })
    })
    describe('#save_poster', () => {
      let save_spy
      beforeEach(() => {
        save_spy = vi.fn(() => Promise.resolve())
        vi.spyOn(Poster.prototype, 'save').mockImplementation(save_spy)
      })
      it('Saves an optimized poster (will have a proper itemid)', async () => {
        localStorage.me = itemid.as_author(poster.id)
        wrapper.vm.new_poster = poster
        wrapper.vm.new_poster.id = '/+16282281824/posters/559667032867'
        await wrapper.vm.save_poster()
        expect(save_spy).toBeCalled()
      })
      it('Only save optimized poster (will have undefined id and a created_at)', async () => {
        poster.created_at = itemid.as_created_at(poster.id)
        poster.id = undefined
        wrapper.vm.new_poster = poster
        await wrapper.vm.save_poster()
        expect(save_spy).not.toBeCalled()
      })
    })
    describe('#remove_poster', () => {
      let confirm_spy
      let delete_spy
      beforeEach(() => {
        confirm_spy = vi.fn(() => true)
        delete_spy = vi.fn(() => Promise.resolve())
        window.confirm = confirm_spy
        vi.spyOn(Poster.prototype, 'delete').mockImplementation(delete_spy)
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
    describe('#picker', () => {
      it('Toggles the picker property on a poster', () => {
        wrapper.vm.picker(poster.id)
      })
    })
    describe('#menu_toggle', () => {
      it('Toggles the picker property on a poster', () => {
        wrapper.vm.menu_toggle(poster.id)
      })
    })
  })
})
