import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import as_statement from '@/components/statements/as-div'
import get_item from '@/modules/item'
const fs = require('fs')
const statements_as_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
describe('@/components/statements/as-div.vue', () => {
  it('Render a statement', async () => {
    const statements = get_item(statements_as_html)
    const wrapper = shallow(as_statement, { propsData: { statement: statements.statements[0] } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
})
