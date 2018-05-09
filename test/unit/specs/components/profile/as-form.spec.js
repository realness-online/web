import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase'

const is_signed_in = jest.fn((callback) => {
  callback({
    user: {
      displayName: 'redirectResultTestDisplayName',
      email: 'redirectTest@test.com',
      emailVerified: true
    }
  })
})

const is_signed_out = jest.fn((callback) => callback())

jest
.spyOn(firebase, 'initializeApp')
.mockImplementation(() => {
  return { auth: () => {} }
})

jest
.spyOn(firebase, 'auth')
.mockImplementation(() => {
  return { onAuthStateChanged: is_signed_out }
})

describe('as-form.vue', () => {
  describe('form', () => {
    it('should render form to set user profile info', () => {
      const person = {
        first_name: 'Scott',
        last_name: 'Fryxell',
        mobile: '4151234356'
      }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('input onblur should save person', () => {
      const person = {
        first_name: 'Scott',
        last_name: 'Fryxell',
        mobile: '4151234356'
      }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let stub = jest.fn()
      let input = wrapper.find('#mobile')
      wrapper.vm.storage.save = stub
      input.trigger('blur')
      expect(stub).toBeCalled()
    })
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
  describe('authorization', () => {
    it('authorize button with valid mobile number', () => {
      const person = { mobile: '4151234567' }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#authorize')
      expect(firebase.auth).toBeCalled()
      expect(is_signed_out).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('authorize button diappears until valid mobile number', () => {
      const person = { mobile: '415123456a' }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#authorize')
      expect(button.exists()).not.toBe(true)
    })
    it('Sign out button when signed in', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      const person = { mobile: '4151234567' }
      let wrapper =  shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#sign-out')
      expect(firebase.auth).toBeCalled()
      expect(is_signed_in).toBeCalled()
      expect(button.exists()).toBe(true)
    })
  })
  describe('#validate_is_human', () => {
    let wrapper, button
    const person = { mobile: '4151234356' }
    beforeEach(() => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_out }
      })
      wrapper = shallow(as_form, { propsData: { person: person } })
      button = wrapper.find('#authorize')

    })
    it('hides authorize button after clicked', () => {
      button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(false)
    })
    it('displays captcha information', () => {
      button.trigger('click')
      expect(wrapper.vm.show_captcha).toBe(true)
      expect(wrapper.find('#captcha').is('div')).toBe(true)
    })
    it('verify the user is a human', () => {
      button.trigger('click')
      wrapper.vm.$nextTick(() => {

        done()
      })
      expect(verify_stub).toBeCalled()
    })


  })
  describe('#sign_in_with_code', () => {

  })
  describe('#sign_out', () => {

  })
})
