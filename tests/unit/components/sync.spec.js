import { shallow } from 'vue-test-utils'
import sync from '@/components/sync'
describe('@/components/sync', () => {
  it('Renders sync component', () => {
    const wrapper = shallow(sync)
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it.todo('Syncronizes localstorage items')
  it.todo('Syncronizes index db items')
  it.todo('Syncronizes on a schedule')
})
