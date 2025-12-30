import { vi } from 'vitest'

// Mock all the complex dependencies properly
vi.mock('@/use/people', () => ({
  use_me: () => ({
    me: {
      value: {
        id: '/+14151234356',
        name: 'Scott Fryxell'
      }
    }
  }),
  as_phone_number: vi.fn(() => '4151234356')
}))

vi.mock('@/utils/serverless', () => ({
  auth: { value: {} },
  Recaptcha: vi.fn().mockImplementation(() => ({
    verify: vi.fn()
  })),
  sign_in: vi.fn(() =>
    Promise.resolve({
      confirm: vi.fn(() => Promise.resolve())
    })
  )
}))

vi.mock('libphonenumber-js', () => {
  const create_parsed_phone = (number_string, country) => {
    const digits = number_string?.replace(/\D/g, '')
    const is_valid = digits && digits.length >= 10
    return is_valid
      ? {
          isValid: () => true,
          nationalNumber: digits.slice(-10),
          phone: digits
        }
      : null
  }

  const mock_fns = {
    AsYouType: vi.fn().mockImplementation(() => ({
      input: vi.fn(() => '1 (415) 123-4356')
    })),
    parseNumber: vi.fn(number_string => {
      const digits = number_string?.replace(/\D/g, '')
      return { phone: digits && digits.length >= 10 ? digits : '' }
    }),
    parsePhoneNumberFromString: vi.fn((number_string, options) =>
      create_parsed_phone(number_string, options?.defaultCountry)
    ),
    findPhoneNumbersInText: vi.fn(text => {
      const digits = text?.replace(/\D/g, '')
      if (digits && digits.length >= 10) {
        return [
          {
            number: {
              number: `+${digits}`
            }
          }
        ]
      }
      return []
    }),
    // Add Vue internal props to prevent errors
    __v_isShallow: undefined,
    __v_isRef: undefined,
    __v_isReadonly: undefined,
    __v_raw: undefined,
    __v_skip: undefined
  }

  return {
    ...mock_fns,
    default: mock_fns
  }
})

export const person = {
  id: '/+14151234356',
  name: 'Scott Fryxell',
  mobile: '4151234356'
}
