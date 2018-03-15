import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import relations from '@/pages/relations'

describe('@/pages/relations.vue', () => {
  it('render relationship information', () => {
    let wrapper = shallow(relations)
    expect(wrapper.element).toMatchSnapshot()
  })
})
