import { shallow } from 'vue-test-utils'
import as_days from '@/components/as-days'
import get_item from '@/modules/item'
const fs = require('fs')
const posts_html = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const person = get_item(posts_html)

describe ('@/components/as-days', () => {
  it ('Renders though is provided nothing', () => {
    const wrapper = shallow(as_days)
    expect(wrapper.element).toMatchSnapshot()
  })
  it ('Renders a list of posts sorted into the days they were created', () => {
    const wrapper = shallow(as_days, { propsData: { posts: person.posts } })
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.vm.days.keys.length).toBe(4)
  })
})
