import { mount, flushPromises } from '@vue/test-utils'
import get_item from '@/use/item'
import * as itemid from '@/use/itemid'
import Feed from '@/views/Feed'
const statements_html = read_mock_file('@@/html/statements.html')
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
    localStorage.me = '/+16282281824'
    vi.spyOn(itemid, 'load').mockImplementation(() => person)
    list_spy = vi.spyOn(itemid, 'list').mockImplementation(id => {
      if (itemid.as_type(id) === 'relations') return Promise.resolve(relations)
      return Promise.resolve(get_item(statements_html).statements)
    })
    vi.spyOn(itemid, 'as_directory').mockImplementation(() =>
      Promise.resolve({ items: ['559666932867'] })
    )
  })
  afterEach(() => {
    localStorage.me = undefined
    vi.clearAllMocks()
  })
  describe('Renders', () => {
    it('handles a removed relation', async () => {
      const stale_person = { person }
      stale_person.visited = undefined
      vi.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(null))
      const wrapper = mount(Feed, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      expect(list_spy).toHaveBeenCalledTimes(2)
    })
    it('A fiendly explanatory message if new person', async () => {
      list_spy.mockImplementation(() => Promise.resolve([]))
      vi.spyOn(itemid, 'as_directory').mockImplementationOnce(() =>
        Promise.resolve({ items: [] })
      )
      const wrapper = mount(Feed, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A feed of statements and posters', async () => {
      const wrapper = mount(Feed, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      expect(list_spy).toHaveBeenCalledTimes(2)
    })
  })
})
