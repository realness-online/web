import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import relationships from '@/pages/relationships'

describe('index.vue', () => {
  it('render layour for who you know', () => {
    let wrapper = shallow(relationships)
    expect(wrapper.element).toMatchSnapshot()
  })
})
