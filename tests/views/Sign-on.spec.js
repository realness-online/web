import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import Sign_on from '@/views/Sign-on.vue'

// Test constants
const MOCK_PHONE = '5555555555'
const MOCK_CODE = '123456'

// Test setup
const setup_component = () => {
  const mock_verify = vi.fn(() => Promise.resolve())
  const mock_confirm = vi.fn(() => Promise.resolve())

  vi.mock('@/use/person', () => ({
    verify_phone: mock_verify,
    confirm_code: mock_confirm
  }))

  const wrapper = shallowMount(Sign_on, {
    global: {
      stubs: ['router-link']
    }
  })

  return { wrapper, mock_verify, mock_confirm }
}

// Test groups
describe('Sign-on', () => {
  describe('initial render', () => {
    it('shows phone input form', () => {
      const { wrapper } = setup_component()
      expect(wrapper.find('input[type="tel"]').exists()).toBe(true)
    })
  })

  describe('phone verification', () => {
    it('submits phone number', async () => {
      const { wrapper, mock_verify } = setup_component()
      const input = wrapper.find('input[type="tel"]')

      await input.setValue(MOCK_PHONE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mock_verify).toHaveBeenCalledWith(MOCK_PHONE)
    })

    it('shows code input after submission', async () => {
      const { wrapper } = setup_component()
      const input = wrapper.find('input[type="tel"]')

      await input.setValue(MOCK_PHONE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('input[type="number"]').exists()).toBe(true)
    })
  })

  describe('code verification', () => {
    it('submits verification code', async () => {
      const { wrapper, mock_confirm } = setup_component()

      // Submit phone first
      await wrapper.find('input[type="tel"]').setValue(MOCK_PHONE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Submit code
      await wrapper.find('input[type="number"]').setValue(MOCK_CODE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mock_confirm).toHaveBeenCalledWith(MOCK_CODE)
    })

    it('handles verification errors', async () => {
      const { wrapper, mock_confirm } = setup_component()
      mock_confirm.mockRejectedValueOnce(new Error('Invalid code'))

      // Submit phone
      await wrapper.find('input[type="tel"]').setValue(MOCK_PHONE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Submit code
      await wrapper.find('input[type="number"]').setValue(MOCK_CODE)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.text()).toContain('Invalid code')
    })
  })
})
