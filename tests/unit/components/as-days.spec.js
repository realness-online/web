import { shallowMount } from '@vue/test-utils'
import as_days from '@/components/as-days'
import get_item from '@/modules/item'
const fs = require('fs')
const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const statements = get_item(statements_html).statements
describe('@/components/as-days', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_days)
  })
  it('Renders though is provided nothing', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Renders a list of statements sorted into the days they were created', async () => {
    await wrapper.setProps({ statements })
    expect(wrapper.element).toMatchSnapshot()
    expect([...wrapper.vm.days.entries()].length).toBe(3)
  })
})
