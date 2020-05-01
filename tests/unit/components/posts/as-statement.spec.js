import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import as_statement from '@/components/posts/as-statement'
const fs = require('fs')
const posts_as_html = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
import get_item from '@/modules/item'

const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe ('@/components/posts/as-statement.vue', () => {
  it ('Render a statement', async () => {
    const posts = get_item(posts_as_html)
    console.log(posts)
    const wrapper = shallow(as_statement, { propsData: { statement: posts.statements[0] } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
})
