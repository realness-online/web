import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import as_form from '@/components/profile/as-form-mobile'
import { sign_in } from '@/utils/serverless-auth'

const mock_phone_integrity = vi.fn().mockResolvedValue({ allowed: true })
const mock_probe = vi
  .fn()
  .mockResolvedValue({ push: false, phone_integrity: true })

vi.mock('@/use/people', () => ({
  use_me: () => ({
    me: { value: { id: '/+14151234356', name: 'Scott Fryxell' } }
  }),
  as_phone_number: vi.fn(() => '4151234356')
}))

vi.mock('@/utils/serverless', () => ({
  auth: { value: {} }
}))

vi.mock('@/utils/serverless-auth', () => ({
  Recaptcha: vi.fn(function () {
    return { verify: vi.fn() }
  }),
  sign_in: vi.fn(() =>
    Promise.resolve({ confirm: vi.fn(() => Promise.resolve()) })
  )
}))

vi.mock('@/use/instance-capabilities', () => ({
  use_instance_capabilities: () => ({
    phone_integrity: { value: true },
    probe: mock_probe
  })
}))

vi.mock('@/utils/phone-integrity', () => ({
  check_phone_integrity: (...args) => mock_phone_integrity(...args)
}))

vi.mock('libphonenumber-js', () => {
  const create_parsed_phone = number_string => {
    const digits = number_string?.replace(/\D/g, '')
    const is_valid = digits && digits.length >= 10
    return is_valid
      ? {
          isValid: () => true,
          nationalNumber: digits.slice(-10),
          phone: digits,
          country: 'US'
        }
      : null
  }

  const mock_fns = {
    AsYouType: vi.fn(function () {
      return { input: vi.fn(n => n ?? '') }
    }),
    parseNumber: vi.fn(),
    parsePhoneNumberFromString: vi.fn((number_string, options) =>
      create_parsed_phone(number_string)
    ),
    findPhoneNumbersInText: vi.fn(() => [])
  }

  return { ...mock_fns, default: mock_fns }
})

describe('as-form-mobile - phone integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_phone_integrity.mockResolvedValue({ allowed: true })
  })

  const mount_ready = async () => {
    const wrapper = await shallowMount(as_form, {
      global: { stubs: { icon: false } }
    })
    await flushPromises()
    wrapper.vm.mobile_number = '4155551234'
    wrapper.vm.on_validate_mobile_number()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('blocks sign-in when the integrity service rejects the number', async () => {
    mock_phone_integrity.mockResolvedValue({ allowed: false })
    const wrapper = await mount_ready()

    await wrapper.find('#authorize').trigger('click')
    await flushPromises()

    expect(mock_phone_integrity).toHaveBeenCalled()
    expect(sign_in).not.toHaveBeenCalled()
    expect(wrapper.find('#integrity-denied').text()).toMatch(/mobile number/i)
  })

  it('blocks sign-in when the integrity service is unavailable', async () => {
    mock_phone_integrity.mockResolvedValue(null)
    const wrapper = await mount_ready()

    await wrapper.find('#authorize').trigger('click')
    await flushPromises()

    expect(sign_in).not.toHaveBeenCalled()
    expect(wrapper.find('#integrity-denied').text()).toMatch(/unavailable/i)
  })

  it('continues to SMS when the integrity service accepts the number', async () => {
    const wrapper = await mount_ready()

    await wrapper.find('#authorize').trigger('click')
    await flushPromises()

    expect(mock_phone_integrity).toHaveBeenCalled()
    expect(wrapper.vm.show_captcha).toBe(true)
  })
})
