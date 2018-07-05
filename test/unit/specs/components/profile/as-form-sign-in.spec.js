import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import 'firebase/auth'

const onAuthStateChanged = jest.fn(state_changed => state_changed())
describe('@/compontent/profile/as-form.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  let firebase_mock
  beforeEach(() => {
    firebase_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
  })
  afterEach(() => {
    firebase_mock.mockReset()
  })

  describe('button#submit-verification success', () => {
    let wrapper, button, confirm_spy, sync_spy
    afterEach(() => {
      confirm_spy.mockReset()
      sync_spy.mockReset()
    })
    beforeEach(() => {
      confirm_spy = jest.fn(() => Promise.resolve('result of confirm_spy') )
      sync_spy = jest.fn()
      wrapper = shallow(as_form, {
        propsData: {
          person: person
        },
        data: {
          show_code: true,
          storage: {
            sync: sync_spy
          },
          authorizer: {
            confirm: confirm_spy
          }
        }
      })
      button = wrapper.find('#submit-verification')
    })
    it('signs the user in with verification code when clicked', () => {
      button.trigger('click')
      expect(confirm_spy).toBeCalled()
    })
    it('calls person_storage.sync', () => {
      let is_signed_in = jest.fn((state_changed) => {
        state_changed({user: person})
      })
      firebase_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          onAuthStateChanged: is_signed_in }
      })
      wrapper = shallow(as_form, {
        propsData: {
          person: person
        },
        data: {
          show_code: true,
          storage: {
            sync: sync_spy
          }
        }
      })
      // wrapper.setData({storage: {sync_spy}})
      button.trigger('click')
      wrapper.vm.storage.sync()
      expect(wrapper.vm.sync_posts).toBeDefined()
      expect(sync_spy).toBeCalled()
    })
    it('updates the search index', () => {
      // let sync_posts_spy = jest.fn()
      // wrapper.vm.sync_posts = sync_posts_spy
      // expect(sync_posts_spy).toBeCalled()
      // expect(wrapper.vm.sync_posts()).toBe(true)
      expect(wrapper.vm.sync_search_index).toBeDefined()
    })

    it('hides input#verification-code when clicked', () => {
      expect(wrapper.find('#verification-code').exists()).toBe(true)
      button.trigger('click')
      expect(wrapper.find('#verification-code').exists()).toBe(false)
      expect(wrapper.vm.show_code).toBe(false)
    })
    it('renders the sign out button when clicked', () => {
      expect(wrapper.vm.show_sign_out).toBe(false)
      button.trigger('click')
      wrapper.vm.$nextTick(() => {
        expect(wrapper.vm.show_sign_out).toBe(true)
      })
    })
  })
  describe('button#sign-out', () => {
    let wrapper, button, is_signed_in, signOut
    afterEach(() => {
      is_signed_in.mockReset()
    })
    beforeEach(() => {
      is_signed_in = jest.fn((state_changed) => {
        state_changed({user: person})
      })
      signOut = jest.fn()
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signOut,
          onAuthStateChanged: is_signed_in }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
      button = wrapper.find('#sign-out')
    })
    it('is displayed when user is signed in', () => {
      expect(firebase.auth).toBeCalled()
      expect(is_signed_in).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('logs the user out when clicked', () => {
      button.trigger('click')
      expect(signOut).toBeCalled()
    })
    it('removes itself when clicked', () => {
      button.trigger('click')
      button = wrapper.find('#sign-out')
      expect(button.exists()).toBe(false)
      expect(wrapper.vm.show_sign_out).toBe(false)
    })
    it('renders the authorize button when clicked', () => {
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(true)
    })
    it('logs the user out if they change their phone number')
  })
})
