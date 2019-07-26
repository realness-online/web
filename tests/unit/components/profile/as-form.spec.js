import { shallow } from 'vue-test-utils'
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
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged }
    })
  })
  describe('profile form', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
    })
    it('should render profile form', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('input#mobile', () => {
    describe('keypress', () => {
      let input, stub, wrapper
      beforeEach(() => {
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
    describe('paste', () => {
      let input, wrapper
      beforeEach(() => {
        wrapper = shallow(as_form, { propsData: { person: {} } })
        input = wrapper.find('#mobile')
      })
      it('should not accept invalid mobile number', () => {
        input.trigger('paste', {
          clipboardData: {
            getData: function() { return 'abc-123-1234' }
          }
        })
        expect(wrapper.vm.person.mobile).toBeFalsy()
      })
      it('should accept 6282281824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData() { return '4151234567' }
          }
        })
        expect(wrapper.vm.person.mobile).toBe('4151234567')
      })
      it('should accept (628) 228-1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData() { return '(628) 228-1824‬' }
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
      it('should accept 628.228.1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData() { return '628.228.1824' }
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
      it('should accept 628-228-1824', () => {
        input.trigger('paste', {
          clipboardData: {
            getData() { return '628-228-1824' }
          }
        })
        expect(wrapper.vm.person.mobile).toBe('6282281824')
      })
    })
  })
  describe('button#authorize', () => {
    let wrapper, button
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
      button = wrapper.find('#authorize')
    })
    it('enabled with valid mobile number', () => {
      expect(firebase.auth).toBeCalled()
      expect(onAuthStateChanged).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('disabled with invalid mobile number', () => {
      const invalid_person = { mobile: '415123456a' }
      wrapper = shallow(as_form, { propsData: { person: invalid_person } })
      button = wrapper.find('#authorize')
      expect(button.is('[disabled]')).toBe(true)
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
  })
  describe('#text_human_verify_code', () => {
    let wrapper, signInWithPhoneNumber
    beforeEach(() => {
      signInWithPhoneNumber = jest.fn(() => Promise.resolve('success'))
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return {
          signInWithPhoneNumber,
          onAuthStateChanged
        }
      })
      wrapper = shallow(as_form, {
        propsData: { person: person }
      })
      wrapper.setData({
        show_code: true
      })
    })
    it('hides captcha div', () => {
      wrapper.vm.text_human_verify_code()
      expect(wrapper.vm.hide_captcha).toBe(true)
    })
    it('renders verification-code input', () => {
      wrapper.vm.text_human_verify_code()
      expect(wrapper.vm.show_code).toBe(true)
    })
  })
  describe('input#verification-code', () => {
    let input, stub, wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, {
        propsData: { person: person }
      })
      wrapper.setData({
        show_code: true,
        code: '12345'
      })
      input = wrapper.find('#verification-code')
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
    it('renders sign in button with valid input', () => {
      let button = wrapper.find('#submit-verification')
      input.trigger('keypress', {
        key: '6',
        preventDefault: stub
      })
      expect(stub).not.toBeCalled()
      expect(button.attributes().disabled).toBe(undefined)
    })
  })
})
