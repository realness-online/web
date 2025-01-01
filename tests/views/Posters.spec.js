import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import Posters from '@/views/Posters'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import { get } from 'idb-keyval'
import { Poster } from '@/persistance/Storage'
import { describe } from 'vitest'
const poster_html = read_mock_file('@@/html/poster.html')
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
  describe('Renders', () => {
    it('UI for posters', () => {
      expect(wrapper.element).toMatchSnapshot()
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
    describe('#toggle_menu', () => {
      it('Toggles the picker property on a poster', () => {
        wrapper.vm.toggle_menu(poster.id)
      })
    })
  })
})
