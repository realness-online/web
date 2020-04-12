import { shallow } from 'vue-test-utils'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import flushPromises from 'flush-promises'
import 'firebase/auth'

describe('@/compontent/profile/as-form.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  describe('Sign in', () => {
    let wrapper, button, confirm_spy
    beforeEach(() => {
      confirm_spy = jest.fn(() => Promise.resolve('result of confirm_spy'))
      wrapper = shallow(as_form, {
        propsData: {
          person: person
        }
      })
      wrapper.setData({
        show_code: true,
        authorizer: {
          confirm: confirm_spy
        }
      })
      button = wrapper.find('#submit-verification')
    })
    it('button#submit-verification signs the user in', () => {
      button.trigger('click')
      expect(confirm_spy).toBeCalled()
    })
    it('Hides input#verification-code when clicked', () => {
      expect(wrapper.find('#verification-code').exists()).toBe(true)
      button.trigger('click')
      expect(wrapper.find('#verification-code').exists()).toBe(false)
      expect(wrapper.vm.show_code).toBe(false)
    })
    it('Sets posts to be resynced', () => {
      sessionStorage.setItem('posts-synced', true)
      button.trigger('click')
      expect(sessionStorage.getItem('posts-synced')).toBeFalsy()
    })
    it('Renders the sign out button after sign in', async () => {
      expect(wrapper.vm.show_sign_out).toBe(false)
      button.trigger('click')
      await flushPromises()
      expect(wrapper.vm.show_sign_out).toBe(true)
    })
  })
  describe('Sign out', () => {
    let wrapper, button, is_signed_in, signOut
    beforeEach(() => {
      is_signed_in = jest.fn((state_changed) => {
        state_changed({ user: person })
      })
      signOut = jest.fn()
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signOut,
          onAuthStateChanged: is_signed_in
}
      })
      wrapper = shallow(as_form, {
        propsData: { person: person }
      })
      button = wrapper.find('#sign-out')
    })
    it('button#sign-out is displayed when user is signed in', () => {
      expect(firebase.auth).toBeCalled()
      expect(is_signed_in).toBeCalled()
      expect(wrapper.vm.show_sign_out).toBe(true)
      expect(button.exists()).toBe(true)
    })
    it('button#sign-out logs the user out when clicked', () => {
      button.trigger('click')
      expect(signOut).toBeCalled()
    })
    it('button#sign-out is removed when clicked', () => {
      button.trigger('click')
      button = wrapper.find('#sign-out')
      expect(button.exists()).toBe(false)
      expect(wrapper.vm.show_sign_out).toBe(false)
    })
    it('Renders the authorize button after sign out', () => {
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(true)
    })
  })
})
