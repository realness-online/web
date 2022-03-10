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
      it('Will ignore a statement that contains a http://', () => {
        const wrapper = shallowMount(wat, {
          data() {
            return {
              statements: [],
              new_statement: 'http://example.com'
            }
          }
        })
        expect(wrapper.vm.statements.length).toBe(0)
        wrapper.vm.prepare_statement()
        expect(wrapper.vm.statements.length).toBe(0)
      })
      it('Will ignore a statement that contains a https://', () => {
        const wrapper = shallowMount(wat, {
          data() {
            return {
              statements: [],
              new_statement: 'https://example.com'
            }
          }
        })
        expect(wrapper.vm.statements.length).toBe(0)
        wrapper.vm.prepare_statement()
        expect(wrapper.vm.statements.length).toBe(0)
      })
      it('Only triggers a statement event when there is text', () => {
        const wrapper = shallowMount(wat, {
          data() {
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
      textarea.trigger('focusin')
      expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
    })
    it('Emits a toggle-keyboard event when loosing focus', () => {
      const wrapper = shallowMount(wat)
      const textarea = wrapper.find('#wat')
      textarea.trigger('focusout')
      expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
    })
    it('Emits a statement-added event when there is text', () => {
      const wrapper = shallowMount(wat, {
        data() {
          return {
            new_statement: 'I like to move it.'
          }
        }
      })
      const textarea = wrapper.find('#wat')
      textarea.trigger('focusout')
      expect(wrapper.emitted('update:statement')).toBeTruthy()
    })
    it('Does not emit statement-added when there is not text', () => {
      const wrapper = shallowMount(wat)
      const textarea = wrapper.find('#wat')
      textarea.trigger('focusout')
      expect(wrapper.emitted('update:statement')).toBe(undefined)
    })
  })
})
