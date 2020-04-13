import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import Item from '@/modules/Item'
import Storage from '@/persistance/Storage'
import as_article from '@/components/posts/as-article'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const post = {
  statement: 'I am saying it',
  created_at: '2019-05-11T22:40:04.580Z',
  id: '/+14151234356/2019-05-11T22:40:04.580Z',
  statements: [],
  person
}
const oldest_post = {
  statement: 'I can say all the stuff',
  created_at: '2019-03-24T20:52:56.031Z',
  id: '/+14151234356/2019-06-24T20:52:56.031Z',
  statements: []
}
describe ('@/components/posts/as-article.vue', () => {
  it ('Render a post as an article element', async () => {
    const wrapper = shallow(as_article, { propsData: { post, person } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it ('Sets an observer if it is the oldest post', () => {
    jest.spyOn(Storage.prototype, 'as_list').mockImplementation(_ => {
      return Item.get_items(posts)
    })
    person.oldest_post = oldest_post.created_at
    const wrapper = shallow(as_article, { propsData: { post: oldest_post, person } })
    expect(wrapper.vm.i_am_oldest).toBe(true)
    person.oldest_post = undefined
  })
  it ('Knows when it is not the oldest post', () => {
    jest.spyOn(Storage.prototype, 'as_list').mockImplementation(_ => {
      return Item.get_items(posts)
    })
    person.oldest_post = oldest_post.created_at
    const wrapper = shallow(as_article, { propsData: { post, person } })
    expect(wrapper.vm.i_am_oldest).toBe(false)
    person.oldest_post = undefined
  })
  it ('Triggers an event if the article is observed', () => {
    const wrapper = shallow(as_article, { propsData: { post, person } })
    const entries = [{ isIntersecting: true }]
    wrapper.vm.end_of_articles(entries)
    expect(wrapper.emitted('end-of-articles')).toBeTruthy()
  })
})
