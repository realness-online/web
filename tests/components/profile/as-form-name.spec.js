import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import as_form from '@/components/profile/as-form-name'

// Mock the composables and utilities
vi.mock('@/use/people', () => ({
  use_me: () => ({
    save: vi.fn(),
    is_valid_name: { value: true }
  })
}))

vi.mock('@/utils/serverless', () => ({
  me: {
    value: {
      name: 'Yu G'
    }
  }
}))

const person = {
  name: 'Yu G',
  mobile: '4151234356'
}

describe('@/component/profile/as-form-name.vue', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = shallowMount(as_form, { props: { person } })
    await flushPromises()
  })

  describe('Renders', () => {
    it('Profile name form', () => {
      expect(wrapper.find('form#profile-name').exists()).toBe(true)
      expect(wrapper.find('input#name').exists()).toBe(true)
    })
  })

  describe('Form Elements', () => {
    it('renders name input', () => {
      const name_input = wrapper.find('input#name')
      expect(name_input.exists()).toBe(true)
      expect(name_input.attributes('placeholder')).toBe('Name')
    })

    it('renders legend with validation class', () => {
      const legend = wrapper.find('legend')
      expect(legend.exists()).toBe(true)
      expect(legend.text()).toBe('Name')
    })
  })

  describe('Methods', () => {
    it('updates name via v-model', async () => {
      const input = wrapper.find('input#name')
      await input.setValue('New Name')
      expect(input.element.value).toBe('New Name')
    })
  })
})
