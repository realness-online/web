import { shallow } from 'vue-test-utils'
import icon from '@/components/icon'

describe('@/components/icon', () => {
  it('Renders an icon', () => {
    const wrapper = shallow(icon, {
      propsData: { name: 'realness' }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
})
