import { shallow, mount } from 'vue-test-utils'
import get_item from '@/modules/item'
import profile_id from '@/helpers/profile'
import itemid from '@/helpers/itemid'
import Feed from '@/views/Feed'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person_html = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const hella_statements = fs.readFileSync('./tests/unit/html/hella_statements.html', 'utf8')
describe ('@/views/Feed.vue', () => {
  let relations_spy, person_spy, statements_spy, mock_person
  beforeEach(() => {
    mock_person = get_item(person_html)
    localStorage.setItem('me', mock_person.id )
    person_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => {
      return Promise.resolve(mock_person)
    })
    relations_spy = jest.spyOn(itemid, 'list').mockImplementationOnce(_ => {
      return []
    })
    statements_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => {
      const statements = get_item(statements_html)
      return Promise.resolve(statements.statements)
    })
    jest.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return { items: [] }
    })

  })
  it.only ('Render a feed of a persons friends', async () => {
    const wrapper = mount(Feed)
    await flushPromises()
    expect(relations_spy).toBeCalled()
    // expect(person_spy).toBeCalled()
    expect(statements_spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
