import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'
import 'firebase/auth'
import * as firebase from 'firebase'
const onAuthStateChanged = jest.fn((callback) => callback())
describe('as-form.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }

  beforeEach(() => {
    jest.resetModules()
  })
  describe('form', () => {
    
    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })
    })
    it('should render form to set user profile info', () => {
      let wrapper = shallow(as_form, { propsData: { person: person } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('input onblur should save person', () => {
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let storage_stub = jest.fn()
      let input = wrapper.find('#mobile')
      wrapper.vm.storage.save = storage_stub
      input.trigger('blur')
      expect(storage_stub).toBeCalled()
    })
  })
  describe('authorization', () => {
    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })
    })
    it('button renders with valid mobile number', () => {
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#authorize')
      expect(firebase.auth).toBeCalled()
      expect(onAuthStateChanged).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('button is gone valid invalid mobile number', () => {
      const invalid_person = { mobile: '415123456a' }
      let wrapper = shallow(as_form, { propsData: { person: invalid_person } })
      let button = wrapper.find('#authorize')
      expect(button.exists()).not.toBe(true)
    })
    it('Sign out button when signed in', () => {
      const is_signed_in = jest.fn((callback) => {
        callback({
          user: {}
        })
      })
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      let wrapper =  shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#sign-out')
      expect(firebase.auth).toBeCalled()
      expect(is_signed_in).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('signs the user out if they change their phone number')
  })
  describe("input#mobile.onKeypress()", () => {
    let input, stub, wrapper
    beforeEach( () => {
      wrapper = shallow(as_form, { propsData: { person: {} } })
      input = wrapper.find('#mobile')
      stub = jest.fn()
    })
    it('should allow valid mobile digits', () => {
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
  describe("input#mobile.onPaste()", () => {
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
  describe('button#authorize.begin_authorization()', () => {
    let wrapper, button

    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
      button = wrapper.find('#authorize')
    })
    it('displays captcha information when clicked', () => {
      button.trigger('click')
      expect(wrapper.vm.show_captcha).toBe(true)
      expect(wrapper.find('#captcha').is('div')).toBe(true)
    })
    it('is removed after click', () => {
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(false)
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
  describe('text_human_verify_code()', () => {
    let wrapper, button, signInWithPhoneNumber, signOut
    beforeEach(() => {
      signInWithPhoneNumber = jest.fn(() => {
        return Promise.resolve('result of signInWithPhoneNumber')
      })
      signOut = jest.fn()
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signOut,
          signInWithPhoneNumber,
          onAuthStateChanged
        }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
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
    let wrapper, button, confirm_spy, signInWithPhoneNumber, signOut
    beforeEach(() => {
      signOut = jest.fn()
      confirm_spy =  jest.fn(() => {
        return Promise.resolve('result of confirm_spy')
      })
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signOut,
          signInWithPhoneNumber,
          onAuthStateChanged
        }
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
    it('signs the user in with valid code', () => {
      button.trigger('click')
      expect(confirm_spy).toBeCalled()
    })
    it('hides input#code-input', () => {
      expect(wrapper.find('#code-input').exists()).toBe(true)
      button.trigger('click')
      expect(wrapper.find('#code-input').exists()).toBe(false)
      expect(wrapper.vm.show_code).toBe(false)
    })
    it('shows the sign out button', () => {
      expect(wrapper.vm.show_sign_out).toBe(false)
      button.trigger('click')
      wrapper.vm.$nextTick( () => {
        expect(wrapper.vm.show_sign_out).toBe(true)
      })
    })
  })
  describe('button#sign-out', () => {
    it('only shows up when the user is signed in')
    it('logs the user out when clicked', () => {
      let signOut = jest.fn()
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signOut,
          onAuthStateChanged
        }
      })
      let wrapper = shallow(as_form, {
        propsData: { person: person },
        data: { show_sign_out: true }
      })
      let button = wrapper.find('#sign-out')
      button.trigger('click')
      expect(signOut).toBeCalled()
      expect(wrapper.vm.show_sign_out).toBe(false)
      expect(wrapper.vm.show_authorize).toBe(true)
    })
  })
  describe('input#code-input', () => {
    let input, stub, wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
      wrapper.setData({
        show_code: true,
        code: '12345'
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
})
