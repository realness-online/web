import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import 'firebase/auth'
import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import Feed from '@/views/Feed'
const statements_html = require('fs').readFileSync('./tests/unit/html/statements.html', 'utf8')
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824',
  visited: new Date().toISOString()
}
const relations = [{ id: '/+14153731893' }]
describe('@/views/Feed.vue', () => {
  let list_spy
  beforeEach(() => {
    firebase.user = { phoneNumber: '+16282281824' }
    localStorage.me = '/+16282281824'
    jest.spyOn(itemid, 'load').mockImplementation(() => person)
    list_spy = jest.spyOn(itemid, 'list').mockImplementation(id => {
      if (itemid.as_type(id) === 'relations') return Promise.resolve(relations)
      else return Promise.resolve(get_item(statements_html).statements)
    })
    jest
      .spyOn(itemid, 'as_directory')
      .mockImplementation(() => Promise.resolve({ items: ['559666932867'] }))
  })
  afterEach(() => {
    firebase.user = undefined
    localStorage.me = undefined
    jest.clearAllMocks()
  })
  describe('Renders', () => {
    it('Handles a removed relation', async () => {
      const stale_person = { person }
      stale_person.visited = undefined
      jest.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(null))
      const wrapper = await shallowMount(Feed)
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      expect(list_spy).toHaveBeenCalledTimes(2)
    })
    it('A fiendly explanatory message if new person', async () => {
      list_spy.mockImplementation(() => Promise.resolve([]))
      jest
        .spyOn(itemid, 'as_directory')
        .mockImplementationOnce(() => Promise.resolve({ items: [] }))
      firebase.user = undefined
      const wrapper = await shallowMount(Feed)
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A feed of statements', async () => {
      jest.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return null
      })
      const wrapper = await shallowMount(Feed)
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      expect(list_spy).toHaveBeenCalledTimes(3)
    })
    it('A feed of statements and posters', async () => {
      const wrapper = await shallowMount(Feed)
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      expect(list_spy).toHaveBeenCalledTimes(3)
    })
  })
  describe('Methods', () => {
    describe('fullscreen', () => {
      it('Enters fullscreen mode', async () => {
        jest.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
          return null
        })
        const wrapper = await shallowMount(Feed)
        await flushPromises()
        expect(() => {
          wrapper.vm.fullscreen()
        }).toThrow()
      })
    })
  })
})
