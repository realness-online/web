import { shallow } from 'vue-test-utils'
import as_article from '@/components/posts/as-article'
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
describe('@/components/posts/as-article.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_article, {
      propsData: { post }
    })
  })
  afterEach
  it('Render a post as an article element', () => {
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
})
