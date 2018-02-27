import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import relationships from '@/pages/relationships'

describe('pages/relationships.vue', () => {
  it('render relationship information', () => {
    let wrapper = shallow(relationships)
    expect(wrapper.element).toMatchSnapshot()
  })
})
