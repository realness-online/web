import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'
import 'firebase/auth'
import * as firebase from 'firebase'

const onAuthStateChanged = jest.fn(state_changed => state_changed())
describe('@/compontent/profile/as-form.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  beforeEach(() => {
    jest.resetModules()
  })
  describe('profile form', () => {
    let wrapper
    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
    })
    it('should render profile form', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('input blur should save person', () => {
      let storage_stub = jest.fn()
      let mobile = wrapper.find('#mobile')
      wrapper.vm.storage.save = storage_stub
      mobile.trigger('blur')
      expect(storage_stub).toBeCalled()
    })
  })
  describe('input#mobile', () => {
    describe("keypress", () => {
      let input, stub, wrapper
      beforeEach( () => {
        wrapper = shallow(as_form, { propsData: { person: {} } })
        input = wrapper.find('#mobile')
        stub = jest.fn()
      })
      it('should accept numbers', () => {
        input.trigger('keypress', {
          key: '2',
          preventDefault: stub
        })
        expect(stub).not.toBeCalled()
      })
      it('should only accept numbers', () => {
        input.trigger('keypress', {
          key: 'a',
          preventDefault: stub
        })
        expect(stub).toBeCalled()
      })
    })
    describe("paste", () => {
      let input, wrapper
      beforeEach(() => {
        wrapper = shallow(as_form, { propsData: { person: {} } })
        input = wrapper.find('#mobile')
      })
      it('should not accept invalid mobile number', () => {
        input.trigger('paste', {
          clipboardData: {
            getData: function(){ return 'abc-123-1234'}
          }
        })
        expect(wrapper.vm.person.mobile).toBeFalsy()
      })
      it('should accept 6282281824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData(){ return '4151234567'}
          }
        })
        expect(wrapper.vm.person.mobile).toBe('4151234567')
      })
      it('should accept (628) 228-1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData(){ return '(628) 228-1824‬'}
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
      it('should accept 628.228.1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData(){ return '628.228.1824'}
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
      it('should accept 628-228-1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData(){ return '628-228-1824'}
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
    })
  })
  describe('button#authorize', () => {
    let wrapper, button
    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
      button = wrapper.find('#authorize')
    })
    it('renders with valid mobile number', () => {
      expect(firebase.auth).toBeCalled()
      expect(onAuthStateChanged).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('dissapears whith invalid mobile number', () => {
      const invalid_person = { mobile: '415123456a' }
      wrapper = shallow(as_form, { propsData: { person: invalid_person } })
      button = wrapper.find('#authorize')
      expect(button.exists()).not.toBe(true)
    })
    it('starts captcha verification when clicked', () => {
      button.trigger('click')
      expect(wrapper.vm.show_captcha).toBe(true)
      let captcha = wrapper.find('#captcha')
      expect(captcha.exists()).toBe(true)
    })
    it('is removed after click', () => {
      expect(button.exists()).toBe(true)
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(false)
      button = wrapper.find('#authorize')
      expect(button.exists()).toBe(false)
    })
    // it('initiates verify()', () => {
    //   const mock_verify = jest.fn()
    //   jest.mock(firebase.auth.RecaptchaVerifier, () => {
    //     return jest.fn().mockImplementation(() => {
    //       return {verify: mock_verify}
    //     })
    //   })
    //   button.trigger('click')
    //   wrapper.vm.$nextTick(done => {
    //     expect(mock_verify).toBeCalled()
    //     done()
    //   })
    // })
    it('sets up callback for validated human')
  })
  describe('input#code-input', () => {
    let input, stub, wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, {
        propsData: { person: person },
        data: {
          show_code: true,
          code: '12345'
        }
      })
      input = wrapper.find('#code-input')
      stub = jest.fn()
    })
    it('should allow valid digits', () => {
      input.trigger('keypress', {
        key: '2',
        preventDefault: stub
      })
      expect(stub).not.toBeCalled()
    })
    it('should only accept numbers', () => {
      input.trigger('keypress', {
        key: 'a',
        preventDefault: stub
      })
      expect(stub).toBeCalled()
    })
    it('enables sign in button when valid input', () => {
      let button = wrapper.find('#submit-code')
      expect(button.attributes().disabled).toBe('disabled')
      input.trigger('keypress', {
        key: '6',
        preventDefault: stub
      })
      expect(stub).not.toBeCalled()
      expect(button.attributes().disabled).toBe(undefined)
    })
  })
  describe('text_human_verify_code()', () => {
    let wrapper, button, signInWithPhoneNumber
    beforeEach(() => {
      signInWithPhoneNumber = jest.fn(() => {
        return Promise.resolve('result of signInWithPhoneNumber')
      })
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signInWithPhoneNumber,
          onAuthStateChanged
        }
      })
      wrapper = shallow(as_form, {
        propsData: { person: person },
        data: {
          show_code: true
        }

      })
      button = wrapper.find('#authorize')
    })
    it('is the callback for the recaptcha')
    it('hides capcha and shows code input', () => {
      // button.trigger('click')
      wrapper.vm.text_human_verify_code()

      expect(wrapper.vm.show_code).toBe(true)
      expect(wrapper.vm.hide_captcha).toBe(true)
    })
  })
  describe('button#submit-code', () => {
    let wrapper, button, confirm_spy, signOut
    beforeEach(() => {
      signOut = jest.fn()
      confirm_spy =  jest.fn(() => {
        return Promise.resolve('result of confirm_spy')
      })
      wrapper = shallow(as_form, {
        propsData: {
          person: person
        },
        data: {
          show_code: true,
          authorizer: {
            confirm: confirm_spy
          }
        }
      })
      button = wrapper.find('#submit-code')
    })
    it('signs the user in with valid code when clicked', () => {
      button.trigger('click')
      expect(confirm_spy).toBeCalled()
    })
    it('hides input#code-input when clicked', () => {
      expect(wrapper.find('#code-input').exists()).toBe(true)
      button.trigger('click')
      expect(wrapper.find('#code-input').exists()).toBe(false)
      expect(wrapper.vm.show_code).toBe(false)
    })
    it('shows the sign out button when clicked', () => {
      expect(wrapper.vm.show_sign_out).toBe(false)
      button.trigger('click')
      wrapper.vm.$nextTick( () => {
        expect(wrapper.vm.show_sign_out).toBe(true)
      })
    })
  })
  describe('button#sign-out', () => {
    let wrapper, button, is_signed_in, signOut
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
      wrapper =  shallow(as_form, { propsData: { person: person } })
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
    it('shows the authorize button when clicked', () => {
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(true)
    })
    it('logs the user out if they change their phone number')
  })
})
