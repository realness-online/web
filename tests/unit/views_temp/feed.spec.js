import { shallow } from 'vue-test-utils'
// import Storage from '@/modules/Storage'
import { person_local, posts_local } from '@/modules/LocalStorage'
import profile_id from '@/modules/profile_id'
import Feed from '@/views/Feed'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')

describe('@/views/Feed.vue', () => {
  // let profile_spy, posts_spy
  beforeEach(() => {
    localStorage.setItem('person', person)
    localStorage.setItem('posts', posts)
    // profile_spy = jest.spyOn(profile_id, 'load').mockImplementation(() => person_local.as_object())
    // posts_spy = jest.spyOn(profile_id, 'items').mockImplementation(() => posts_local.as_list())
    jest.spyOn(profile_id, 'load').mockImplementation(() => person_local.as_object())
    jest.spyOn(profile_id, 'items').mockImplementation(() => posts_local.as_list())
  })
  it('render the feed', () => {
    let wrapper = shallow(Feed)
    expect(wrapper.element).toMatchSnapshot()
    // expect(profile_spy).toBeCalled()
    // expect(posts_spy).toBeCalled()
    // expect(wrapper.vm.feed.length).toBe(54)
  })
})
