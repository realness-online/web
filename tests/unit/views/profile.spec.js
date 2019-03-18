import { shallow } from 'vue-test-utils'
import profile from '@/views/Profile'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '14151231234'
  })
})
const not_signed_in = jest.fn(state_changed => state_changed())
describe('@/views/Profile.vue', () => {
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged: not_signed_in }
    })
  })
  it('shows the users profile information', () => {
    let $route = { params: {} }
    let wrapper = shallow(profile, { mocks: { $route } })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('shows profile information for a phone number', () => {
    jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => {
      return {
        id: '/+14155551234'
      }
    })
    const mock_load_from_network = jest.fn()
    jest.spyOn(profile.methods, 'load_from_network').mockImplementation(mock_load_from_network)
    const $route = { params: { phone_number: '+14151231234' } }
    let wrapper = shallow(profile, { mocks: { $route } })
    expect(mock_load_from_network).toHaveBeenCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
})
