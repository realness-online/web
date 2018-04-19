import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'

jest.mock('firebase')
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
    beforeEach( () => {
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
  describe('input#mobile ~ button', () => {
    it('authorize button appears with valid mobile number', () => {
      const person = { mobile: '4151234567' }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#mobile ~ button')
      expect(button.exists()).toBe(true)
    })
    it('authorize button diappears until valid mobile number', () => {
      // const person = { mobile: 'aaaaaaaaaa' }
      const person = { mobile: '415123456a' }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#mobile ~ button')
      expect(button.exists()).not.toBe(true)
    })
    it('authorize an account with mobile phone number', () => {
      const person = { mobile: '4151234567' }
      let wrapper = shallow(as_form, { propsData: { person: person } })
      let button = wrapper.find('#mobile ~ button')
      button.trigger('click')
      expect(person.authorized).toBe(true)
    })
  })
})
