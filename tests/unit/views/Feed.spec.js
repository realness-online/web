import { shallow } from 'vue-test-utils'
import Item from '@/modules/Item'
import profile_id from '@/helpers/profile'
import itemid from '@/helpers/itemid'
import Feed from '@/views/Feed'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const hella_posts = fs.readFileSync('./tests/unit/html/hella_posts.html', 'utf8')
describe ('@/views/Feed.vue', () => {
  let person_spy, posts_spy, mock_person, mock_posts
  beforeEach(() => {
    mock_posts = Item.get_items(posts)
    mock_person = Item.get_first_item(person)
    person_spy = jest.spyOn(itemid, 'as_object').mockImplementation(_ => mock_person)
    posts_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => mock_posts)
  })
  it ('Render a feed of a persons friends', async () => {
    const wrapper = shallow(Feed)
    await flushPromises()
    expect(person_spy).toBeCalled()
    expect(posts_spy).toBeCalled()
    expect(wrapper.vm.days.size).toBe(5)
    expect(wrapper.element).toMatchSnapshot()
  })
  it ('Loads another page of data for a person', async () => {
    const wrapper = shallow(Feed)
    const hella_list = Item.get_items(hella_posts)
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
