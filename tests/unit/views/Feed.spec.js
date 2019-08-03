import { shallow } from 'vue-test-utils'
import LocalStorage, { person_local, posts_local } from '@/modules/LocalStorage'
import Storage  from '@/modules/Storage'
import Item from '@/modules/Item'
import profile_id from '@/models/profile_id'
import Feed from '@/views/Feed'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const other_posts = fs.readFileSync('./tests/unit/html/other_posts.html', 'utf8')
describe('@/views/Feed.vue', () => {
  let profile_spy, posts_spy, mock_person, mock_posts
  beforeEach(() => {
    mock_posts = Item.get_items(Storage.hydrate(posts))
    mock_person = Item.get_first_item(Storage.hydrate(person))
    profile_spy = jest.spyOn(profile_id, 'load').mockImplementation(_ => mock_person)
    posts_spy = jest.spyOn(profile_id, 'items').mockImplementation(_ => mock_posts)
  })
  it('Render a feed of a persons friends', async() => {
    let wrapper = shallow(Feed)
    await flushPromises()
    expect(profile_spy).toBeCalled()
    expect(posts_spy).toBeCalled()
    expect(wrapper.vm.days.size).toBe(18)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Loads another page of data for a person', async() => {
    let wrapper = shallow(Feed)
    await flushPromises()
    expect(wrapper.vm.days.size).toBe(18)
    jest.spyOn(profile_id, 'items').mockImplementationOnce(_ => {
      return Item.get_items(Storage.hydrate(other_posts))
    })
    wrapper.vm.next_page(mock_person)
    await flushPromises()
    expect(wrapper.vm.days.size).toBe(23)
  })
})
