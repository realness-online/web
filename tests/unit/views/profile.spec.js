import { shallow } from 'vue-test-utils'
import Profile from '@/views/Profile'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const onAuthStateChanged = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '14151231234'
  })
})
describe('@/views/Profile.vue', () => {
  it('shows profile information for a phone number', () => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => onAuthStateChanged)
    const $route = { params: { phone_number: '+14151231234' } }
    let wrapper = shallow(Profile, { mocks: { $route } })
    expect(wrapper.element).toMatchSnapshot()
  })
})
