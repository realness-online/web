import { shallow } from 'vue-test-utils'
import get_item from '@/modules/item'
import * as itemid from '@/helpers/itemid'
import Feed from '@/views/Feed'
const fs = require('fs')
const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
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
    jest.spyOn(itemid, 'as_directory').mockImplementationOnce(_ => {
      return { items: [] }
    })
  })
  it('Render a feed of a persons friends', async () => {
    const wrapper = shallow(Feed)
    expect(relations_spy).toBeCalled()
    expect(statements_spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
