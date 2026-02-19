import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import wat from '@/components/thoughts/as-textarea'

vi.mock('@/use/statement', () => ({
  use: () => ({
    save: vi.fn()
  })
}))

vi.mock('@/use/key-commands', () => ({
  use_keymap: vi.fn(() => ({
    register: vi.fn()
  }))
}))

Object.defineProperty(document, 'querySelector', {
  value: vi.fn(() => ({
    focus: vi.fn(),
    scrollIntoView: vi.fn()
  })),
  writable: true
})

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true
})

describe('@/components/thoughts/as-textarea.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(wat, {
      global: {
        stubs: {
          icon: false
        }
      }
    })
  })

  describe('Renders', () => {
    it('A textarea for thought input', () => {
      expect(wrapper.find('textarea#wat').exists()).toBe(true)
    })

    it('renders with proper attributes', () => {
      const textarea = wrapper.find('textarea#wat')
      expect(textarea.exists()).toBe(true)
      expect(textarea.attributes('placeholder')).toBeDefined()
    })
  })

  describe('Props and Data', () => {
    it('has thought_text ref', () => {
      expect(wrapper.vm.thought_text).toBeDefined()
    })
  })

  describe('Methods', () => {
    describe('#focused', () => {
      it('emits toggle-keyboard event', async () => {
        await wrapper.vm.focused()
        expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
      })
    })

    describe('#prepare_thought', () => {
      it('exists as a function', () => {
        expect(typeof wrapper.vm.prepare_thought).toBe('function')
      })
    })
  })

  describe('Events', () => {
    it('emits toggle-keyboard when focused', async () => {
      await wrapper.vm.focused()
      expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
    })
  })
})
