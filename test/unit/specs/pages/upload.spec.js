import { shallow } from 'vue-test-utils'
import upload from '@/pages/upload'

describe('@/pages/upload.vue', () => {
  it('displays and uploads profile pictue ', () => {
    let wrapper = shallow(upload)
    expect(wrapper.element).toMatchSnapshot()
  })
})
