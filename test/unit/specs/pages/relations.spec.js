import { shallow } from 'vue-test-utils'
import relations from '@/pages/relations'

describe('@/pages/relations.vue', () => {
  it('render relationship information', () => {
    let wrapper = shallow(relations)
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('searchibg', () => {
    it('renders a search icon and input')
    describe('query', () => {
      it('can search by first name')
      it('can search by last name')
      it('can search by mobile number')
    })
    describe('results', () => {
      it('a person can declare a relationship')
      it('a person can block a relationship')
    })
  })
  describe('reltionships', () => {
    it('are in a list')
    it('can be blocked')
    it('can be deleted')
  })
})
