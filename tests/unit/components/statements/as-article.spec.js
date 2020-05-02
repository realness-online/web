import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import get_item from '@/modules/item'
import as_article from '@/components/statements/as-article'
import itemid from '@/helpers/itemid'
const fs = require('fs')
const statements = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const statement = {
  statement: 'I am saying it',
  created_at: '2019-05-11T22:40:04.580Z',
  id: '/+14151234356/2019-05-11T22:40:04.580Z',
  statements: [],
  person
}
const oldest_statement = {
  statement: 'I can say all the stuff',
  created_at: '2019-03-24T20:52:56.031Z',
  id: '/+14151234356/2019-06-24T20:52:56.031Z',
  statements: []
}
describe ('@/components/statements/as-article.vue', () => {
  it ('Render a statement as an article element', async () => {
    const wrapper = shallow(as_article, { propsData: { statement, person } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it ('Sets an observer if it is the oldest statement', () => {
    jest.spyOn(itemid, 'list').mockImplementation(_ => {
      return get_item(statements)
    })
    person.oldest_statement = oldest_statement.created_at
    const wrapper = shallow(as_article, { propsData: { statement: oldest_statement, person } })
    expect(wrapper.vm.i_am_oldest).toBe(true)
    person.oldest_statement = undefined
  })
  it ('Knows when it is not the oldest statement', () => {
    jest.spyOn(itemid, 'list').mockImplementation(_ => {
      return get_item(statements)
    })
    person.oldest_statement = oldest_post.created_at
    const wrapper = shallow(as_article, { propsData: { statement, person } })
    expect(wrapper.vm.i_am_oldest).toBe(false)
    person.oldest_statement = undefined
  })
  it ('Triggers an event if the article is observed', () => {
    const wrapper = shallow(as_article, { propsData: { statement, person } })
    const entries = [{ isIntersecting: true }]
    wrapper.vm.end_of_articles(entries)
    expect(wrapper.emitted('end-of-articles')).toBeTruthy()
  })
})
