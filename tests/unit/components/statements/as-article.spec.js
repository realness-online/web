import { shallowMount } from '@vue/test-utils'
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
  id: '/+14151234356/statements/1557614404580'
}
const older_statement = {
  statement: 'I can say all the stuff',
  id: '/+14151234356/statements/1553460776031'
}
describe('@/components/statements/as-article.vue', () => {
  it('Render a statement as an article element', async () => {
    const wrapper = shallowMount(as_article, { propsData: { statements: [statement, older_statement] } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
})
