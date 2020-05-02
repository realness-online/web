import { shallow } from 'vue-test-utils'
import get_item from '@/modules/item'
import profile_id from '@/helpers/profile'
import itemid from '@/helpers/itemid'
import Feed from '@/views/Feed'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const statements = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const hella_statements = fs.readFileSync('./tests/unit/html/hella_statements.html', 'utf8')
describe ('@/views/Feed.vue', () => {
  let person_spy, statements_spy, mock_person, mock_statements
  beforeEach(() => {
    mock_statements = get_item(statements).statements
    mock_person = get_item(person)
    person_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => mock_person)
    statements_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => mock_statements)
  })
  it ('Render a feed of a persons friends', async () => {
    const wrapper = shallow(Feed)
    await flushPromises()
    expect(person_spy).toBeCalled()
    expect(statements_spy).toBeCalled()
    expect(wrapper.vm.days.size).toBe(5)
    expect(wrapper.element).toMatchSnapshot()
  })
  it ('Loads another page of data for a person', async () => {
    const wrapper = shallow(Feed)
    const hella_list = get_item(hella_statements)
    await flushPromises()
    expect(wrapper.vm.days.size).toBe(5)
    jest.spyOn(itemid, 'load').mockImplementationOnce(_ => {
      return hella_list
    })
    wrapper.vm.next_page(mock_person)
    await flushPromises()
    expect(wrapper.vm.days.size).toBe(22)
  })
})
