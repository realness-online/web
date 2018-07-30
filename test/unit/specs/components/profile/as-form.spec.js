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
  describe('profile form', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
    })
    it('should render profile form', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('input blur should save person', () => {
      let storage_stub = jest.fn()
      wrapper.vm.person.first_name = 'changed'
      let mobile = wrapper.find('#mobile')
      wrapper.vm.storage.save = storage_stub
      mobile.trigger('blur')
      wrapper.vm.$nextTick(() => {
        expect(storage_stub).toBeCalled()
      })
    })
  })
  describe('#save_person', () => {
    let wrapper, storage_save
    beforeEach(() => {
      wrapper = shallow(as_form, { propsData: { person: person } })
      storage_save = jest.fn()
      wrapper.vm.storage.save = storage_save
    })
    afterEach(() => {
      storage_save.mockReset()
    })
    it('should set created_at when new', () => {
      wrapper.vm.save_person()
      expect(wrapper.vm.person.created_at).toBeDefined()
      expect(wrapper.vm.person.updated_at).toBeDefined()
      wrapper.vm.$nextTick(() => {
        expect(storage_save).toBeCalled()
      })

    })
    describe('updating', () => {
      let last_update
      beforeEach(() => {
        wrapper.vm.person.created_at = '2018-07-20T03:35:45.289Z'
        wrapper.vm.person.updated_at = wrapper.vm.person.created_at
        wrapper.vm.storage.as_object = () => {
          return {
            first_name: 'Scott',
            last_name: 'Fryxell',
            mobile: '4151234356'
          }
        }
        last_update = wrapper.vm.person.updated_at
      })
      it('should change updated_at if first name has changed', () => {
        wrapper.vm.person.first_name = 'Joe'
        wrapper.vm.save_person()
        expect(wrapper.vm.person.updated_at).not.toBe(last_update)
      })
      it('should change updated_at if last name has changed', () => {
        wrapper.vm.person.last_name = 'Malarky'
        wrapper.vm.save_person()
        expect(wrapper.vm.person.updated_at).not.toBe(last_update)
      })
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
    it('renders with valid mobile number', () => {
      expect(firebase.auth).toBeCalled()
      expect(onAuthStateChanged).toBeCalled()
      expect(button.exists()).toBe(true)
    })
    it('removed with invalid mobile number', () => {
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
  })
  describe('#text_human_verify_code', () => {
    let wrapper, signInWithPhoneNumber
    beforeEach(() => {
      signInWithPhoneNumber = jest.fn(() => Promise.resolve('success') )
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
        propsData: { person: person },
        data: {
          show_code: true,
          code: '12345'
        }
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
