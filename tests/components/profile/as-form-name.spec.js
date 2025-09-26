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
      first_name: 'Yu',
      last_name: 'G'
    }
  }
}))

const person = {
  first_name: 'Yu',
  last_name: 'G',
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
      expect(wrapper.find('input#first-name').exists()).toBe(true)
      expect(wrapper.find('input#last-name').exists()).toBe(true)
    })
  })

  describe('Form Elements', () => {
    it('renders first name input', () => {
      const first_name_input = wrapper.find('input#first-name')
      expect(first_name_input.exists()).toBe(true)
      expect(first_name_input.attributes('placeholder')).toBe('First')
    })

    it('renders last name input', () => {
      const last_name_input = wrapper.find('input#last-name')
      expect(last_name_input.exists()).toBe(true)
      expect(last_name_input.attributes('placeholder')).toBe('Last')
    })

    it('renders legend with validation class', () => {
      const legend = wrapper.find('legend')
      expect(legend.exists()).toBe(true)
      expect(legend.text()).toBe('Name')
    })
  })

  describe('Methods', () => {
    describe('#save_me', () => {
      it('emits valid event when name is valid', async () => {
        await wrapper.vm.save_me()
        expect(wrapper.emitted('valid')).toBeTruthy()
      })
    })
  })
})