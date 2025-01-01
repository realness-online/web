import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import PhoneBook from '@/views/PhoneBook'

const MOCK_YEAR = 2000
const MOCK_MONTH = 13

describe('@/views/PhoneBook', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(MOCK_YEAR, MOCK_MONTH))
    wrapper = shallowMount(PhoneBook)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Renders', () => {
    it('renders phone book view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  // Restructured to avoid excessive nesting
  describe('Methods', () => {
    describe('#load_contacts', () => {
      it('loads contacts from storage', async () => {
        await wrapper.vm.load_contacts()
        expect(wrapper.vm.contacts).toEqual([])
      })
    })

    describe('#save_contact', () => {
      it('saves new contact', async () => {
        const contact = { name: 'Test User', phone: '1234567890' }
        await wrapper.vm.save_contact(contact)
        expect(wrapper.vm.contacts).toContain(contact)
      })
    })

    describe('#remove_contact', () => {
      it('removes existing contact', async () => {
        const contact = { name: 'Test User', phone: '1234567890' }
        wrapper.vm.contacts = [contact]
        await wrapper.vm.remove_contact(contact)
        expect(wrapper.vm.contacts).not.toContain(contact)
      })
    })
  })
})
