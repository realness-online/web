import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import Item from '@/modules/Item'
import LocalStorage from '@/modules/LocalStorage'
import Storage from '@/modules/Storage'
import as_article from '@/components/posts/as-article'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')

const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const post = {
  articleBody: 'I am saying it',
  created_at: '2019-05-11T22:40:04.580Z',
  id: '/+14151234356/2019-05-11T22:40:04.580Z',
  person
}
const oldest_post = {
  articleBody: 'I can say all the stuff',
  created_at: '2019-06-24T20:52:56.031Z',
  id: '/+14151234356/2019-06-24T20:52:56.031Z'
}
describe('@/components/posts/as-article.vue', () => {
  it('Render a post as an article element', async() => {
    const wrapper = shallow(as_article, { propsData: { post } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it('Sets an observer if it is the oldest post', () => {
    jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(_ => {
      return Item.get_items(Storage.hydrate(posts))
    })
    const wrapper = shallow(as_article, { propsData: { post: oldest_post } })
    expect(wrapper.vm.i_am_oldest).toBe(true)
  })
  it('knows when it is not the oldest post', () => {
    jest.spyOn(LocalStorage.prototype, 'as_list').mockImplementation(_ => {
      return Item.get_items(Storage.hydrate(posts))
    })
    const wrapper = shallow(as_article, { propsData: { post } })
    expect(wrapper.vm.i_am_oldest).toBe(false)
  })
  it('Triggers an event if the article is observed', () => {
    const wrapper = shallow(as_article, { propsData: { post } })
    const entries = [{ isIntersecting: true }]
    wrapper.vm.end_of_articles(entries)
    expect(wrapper.emitted('next-page')).toBeTruthy
  })
})
