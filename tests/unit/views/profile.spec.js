import { shallow } from 'vue-test-utils'
import profile from '@/pages/profile'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '14151231234'
  })
})
describe('@/pages/profile.vue', () => {
  it('shows the users profile information', () => {
    let $route = { params: {} }
    let wrapper = shallow(profile, { mocks: { $route } })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('shows a phone numbers profile information', () => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged: is_signed_in }
    })
    const $route = { params: { phone_number: '14151231234' } }
    let wrapper = shallow(profile, { mocks: { $route } })
    expect(wrapper.element).toMatchSnapshot()
  })
})
