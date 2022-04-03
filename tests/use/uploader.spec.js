import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import { get } from 'idb-keyval'
import { Poster } from '@/persistance/Storage'
import fs from 'fs'
import { describe } from 'vitest'
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
    wrapper = mount(Posters, {
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
    wrapper.vm.events = events
  })
  afterEach(() => {
    localStorage.me = undefined
  })
  describe('Lifecycle', () => {
    it('Unmounts the worker when destroyed', async () => {
      wrapper.vm.vectorizer
      wrapper.vm.optimizer
      wrapper.unmount()
      expect(wrapper.vm.vectorizer.terminate).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.optimizer.terminate).toHaveBeenCalledTimes(1)
    })
  })
  describe('Computed', () => {
    describe('.as_itemid', () => {
      it('returns itemid for new poster', () => {
        wrapper = mount(Posters, {
          global: { stubs: ['router-link'] }
        })
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
        console.log(poster.regular)
        const event = {
          data: {
            vector: {
              light: {
                d: poster.light.getAttribute('d'),
                fillOpacity: '0.208'
              },
              regular: {
                d: poster.light.getAttribute('d'),
                fillOpacity: '0.85'
              },
              bold: {
                d: poster.light.getAttribute('d'),
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
  })
})
