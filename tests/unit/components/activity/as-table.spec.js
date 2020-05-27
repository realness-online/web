import { shallow } from 'vue-test-utils'
import table from '@/components/activity/as-table'
describe('@/components/developer-tools.js', () => {
  it('Renders developer tools', () => {
    const wrapper = shallow(table)
    expect(wrapper.element).toMatchSnapshot()
  })
  it.todo('Logs console.info calls to the activity logger')
  it.todo('Logs errors to the activity logger')
  it.todo('Attaches to the console and error logger')
})
