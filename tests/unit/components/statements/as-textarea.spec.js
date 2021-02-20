import { shallowMount } from '@vue/test-utils'
import wat from '@/components/statements/as-textarea'
describe('@/components/statements/as-textarea.vue', () => {
  describe('Renders', () => {
    it('A texarea for statement input', () => {
      const wrapper = shallowMount(wat)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    it('#wat_focused', () => {
      expect(typeof wat.methods.focused).toBe('function')
    })
    describe('#prepare_statement', () => {
      it('Exists', () => {
        expect(typeof wat.methods.prepare_statement).toBe('function')
      })
      it('Only triggers a statement event when there is text', () => {
        const wrapper = shallowMount(wat, {
          data () {
            return {
              statements: [],
              new_statement: ''
            }
          }
        })
        expect(wrapper.vm.statements.length).toBe(0)
        wrapper.vm.prepare_statement()
        expect(wrapper.vm.statements.length).toBe(0)
      })
    })
  })
  describe('Events', () => {
    it('Emits a toggle-keyboard event when focused', () => {
      const wrapper = shallowMount(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('toggle-keyboard', spy)
      textarea.trigger('focusin')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('Emits a toggle-keyboard event when loosing focus', () => {
      const wrapper = shallowMount(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('toggle-keyboard', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('Emits a statement-added event when there is text', () => {
      const wrapper = shallowMount(wat, {
        data () {
          return {
            new_statement: 'I like to move it.'
          }
        }
      })
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('update:statement', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('Does not emit statement-added when there is not text', () => {
      const wrapper = shallowMount(wat)
      const textarea = wrapper.find('#wat')
      const spy = jest.fn()
      wrapper.vm.$on('update:statement', spy)
      textarea.trigger('focusout')
      expect(spy).toHaveBeenCalledTimes(0)
    })
  })
})
