import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import profile from '@/profile'

describe('index.vue', () => {
  it('render layour for who you know', () => {
    let wrapper = shallow(profile)
    expect(wrapper.element).toMatchSnapshot()
  })
})
