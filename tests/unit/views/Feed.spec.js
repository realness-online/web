import { shallowMount } from '@vue/test-utils'
import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import Feed from '@/views/Feed'
const statements_html = require('fs').readFileSync('./tests/unit/html/statements.html', 'utf8')
describe('@/views/Feed.vue', () => {
  let relations_spy, statements_spy
  beforeEach(() => {
    localStorage.setItem('me', '/+16282281824')
    relations_spy = jest.spyOn(itemid, 'list').mockImplementationOnce(_ => {
      return []
    })
    statements_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => {
      const statements = get_item(statements_html)
      return Promise.resolve(statements.statements)
    })
    jest.spyOn(itemid, 'as_directory').mockImplementation(_ => {
      return { items: ['559666932867'] }
    })
  })
  describe('Renders', () => {
    it('A feed of statements', async () => {
      jest.spyOn(itemid, 'as_directory').mockImplementationOnce(_ => {
        return null
      })
      const wrapper = shallowMount(Feed)
      expect(relations_spy).toBeCalled()
      expect(statements_spy).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A feed of statements and posters', async () => {
      const wrapper = shallowMount(Feed)
      expect(relations_spy).toBeCalled()
      expect(statements_spy).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
