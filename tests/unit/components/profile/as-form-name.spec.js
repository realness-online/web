import { shallow } from 'vue-test-utils'
import as_form from '@/components/profile/as-form-name'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const onAuthStateChanged = jest.fn(state_changed => state_changed())
describe('@/compontent/profile/as-form-name.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  describe('profile form', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
    })
    it('Render profile name form', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it.todo('requires at least 3 letters total for a name')
  })
})
