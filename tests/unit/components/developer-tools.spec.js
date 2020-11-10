import { shallowMount } from '@vue/test-utils'
import tools from '@/components/developer-tools'
describe('@/components/developer-tools.js', () => {
  it('Renders developer tools', () => {
    const wrapper = shallowMount(tools)
    expect(wrapper.element).toMatchSnapshot()
  })
})
