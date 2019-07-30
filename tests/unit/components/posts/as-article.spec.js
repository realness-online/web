import { shallow } from 'vue-test-utils'
import as_article from '@/components/posts/as-article'
import flushPromises from 'flush-promises'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const post = {
  articleBody: 'I am saying it',
  created_at: '2019-05-11T22:40:04.580Z',
  id: '/+14151234356/2019-05-11T22:40:04.580Z',
  statements: [],
  person
}
const statement = {
  articleBody: 'I am making a statement',
  created_at: '2019-05-11T22:50:04.580Z',
  id: '/+14151234356/2019-05-11T22:40:04.580Z'
}

describe('@/components/posts/as-article.vue', () => {

  it('Render a post as an article element', async() => {
    const wrapper = shallow(as_article, { propsData: { post } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it('Sets an observer if it is the oldest post', () => {
    post.person.oldest_post = post.created_at
    const wrapper = shallow(as_article, { propsData: { post } })
    expect(wrapper.vm.i_am_oldest).toBe(true)
  })
  it('Sets an observer if one of a posts statements is the oldest post', () => {
    post.person.oldest_post = statement.created_at
    post.statements.push(statement)
    const wrapper = shallow(as_article, { propsData: { post } })
    expect(wrapper.vm.i_am_oldest).toBe(true)
  })
  it('Triggers an event if the article is observed', () => {
    const wrapper = shallow(as_article, {propsData: { post } })
    const entries = [{ isIntersecting:true }]
    wrapper.vm.end_of_posts(entries)
    expect(wrapper.emitted('next-page')).toBeTruthy
  })
})
