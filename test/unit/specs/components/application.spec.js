import { shallow } from 'vue-test-utils'
import application from '@/components/application'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import 'firebase/auth'

const signed_out = jest.fn(state_changed => state_changed())
const signed_in = jest.fn((state_changed) => { state_changed({user: {} }) })
describe('@/components/application.vue', () => {
  let firebase_mock
  beforeEach(() => {
    firebase_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged:signed_out }
    })
  })

  it('renders layout for the application', () => {
    let wrapper = shallow(application)
    expect(wrapper.element).toMatchSnapshot()
  })

  it('syncs person\'s data with the server on application start', () => {
    firebase_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged:signed_in }
    })
    let sync_spy = jest.fn()
    let wrapper = shallow(application, {
      data: {
        storage: {
          sync: sync_spy
        }
      }
    })
    expect(sync_spy).toBeCalled()
  })

  it('only syncs data for people who are signed in', () => {
    let sync_spy = jest.fn()
    let wrapper = shallow(application, {
      data: {
        storage: {
          sync: sync_spy
        }
      }
    })
    expect(sync_spy).not.toBeCalled()
  })
})
