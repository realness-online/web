import { mount } from '@vue/test-utils'
import icon from '@/components/icon'

describe('@/components/icon', () => {
  it('Renders an icon', () => {
    const wrapper = mount(icon, {
      props: { name: 'realness' }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
})
