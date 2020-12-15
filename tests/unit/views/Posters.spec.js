import { shallowMount } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/modules/item'
import itemid from '@/helpers/itemid'
import { get } from 'idb-keyval'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
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
    describe('as_itemid', () => {
      wrapper = shallowMount(Posters)
      localStorage.me = '/+16282281824'
      wrapper.vm.new_poster = { created_at: 'now' }
      expect(wrapper.vm.as_itemid).toBe('/+16282281824/posters/now')
    })
  })
  describe('methods:', () => {
    describe('get_id', () => {
      it('gets the poster id from the directory listing on hte network', () => {
        wrapper.vm.get_id(`${poster.id}.html`)
      })
    })
    describe('#vectorize', () => {
      it('executes the method', () => {
        wrapper.vm.vectorize()
      })
    })
    describe('#vectorized', () => {
      it('gets the poster from the worker', () => {
        const event = {
          data: poster
        }
        wrapper.vm.working = true
        wrapper.vm.vectorized(event)
        expect(wrapper.vm.working).toBe(false)
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
      it('updates new_poster with the optimized vector', () => {
        wrapper.vm.optimized({ data: { vector: poster_html } })
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
      it('executes the method', () => {
        wrapper.vm.cancel_poster(poster.id)
      })
    })
    describe('#save_poster', () => {
      it('executes the method', async () => {
        await wrapper.vm.save_poster(poster.id)
      })
    })
    describe('#remove_poster', () => {
      it('executes the method', async () => {
        await wrapper.vm.remove_poster(poster.id)
      })
    })
  })
})
