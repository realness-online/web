import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import wat from '@/components/statements/as-textarea'

// Mock the composables and utilities
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

// Mock document methods
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

describe('@/components/statements/as-textarea.vue', () => {
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
    it('A textarea for statement input', () => {
      expect(wrapper.find('textarea#wat').exists()).toBe(true)
    })

    it('renders with proper attributes', () => {
      const textarea = wrapper.find('textarea#wat')
      expect(textarea.exists()).toBe(true)
      expect(textarea.attributes('placeholder')).toBeDefined()
    })
  })

  describe('Props and Data', () => {
    it('has statement_text ref', () => {
      expect(wrapper.vm.statement_text).toBeDefined()
    })
  })

  describe('Methods', () => {
    describe('#focused', () => {
      it('emits toggle-keyboard event', async () => {
        await wrapper.vm.focused()
        expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
      })
    })

    describe('#prepare_statement', () => {
      it('exists as a function', () => {
        expect(typeof wrapper.vm.prepare_statement).toBe('function')
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
