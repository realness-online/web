import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsFieldset from '@/components/events/as-fieldset.vue'
import firebase from '@/persistance/firebase'

const MOCK_YEAR = 2020

describe('@/components/events/as-fieldset', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(AsFieldset)
  })

  describe('Form Rendering', () => {
    it('renders form elements', () => {
      expect(wrapper.find('fieldset').exists()).toBe(true)
      expect(wrapper.find('input[type="text"]').exists()).toBe(true)
      expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    })

    it('shows validation messages', async () => {
      await wrapper.setData({ error: 'Test error' })
      expect(wrapper.text()).toContain('Test error')
    })
  })

  describe('Event Handling', () => {
    const test_event = {
      title: 'Test Event',
      date: new Date(MOCK_YEAR, 0, 1)
    }

    beforeEach(async () => {
      await wrapper.setProps({ event: test_event })
    })

    it('updates event title', async () => {
      const title_input = wrapper.find('input[type="text"]')
      await title_input.setValue('Updated Title')
      expect(wrapper.emitted('update:event')).toBeTruthy()
    })

    it('updates event date', async () => {
      const date_input = wrapper.find('input[type="date"]')
      await date_input.setValue('2023-01-01')
      expect(wrapper.emitted('update:event')).toBeTruthy()
    })
  })

  describe('Firebase Integration', () => {
    beforeEach(() => {
      vi.spyOn(firebase, 'collection').mockReturnValue({
        doc: vi.fn().mockReturnThis(),
        set: vi.fn().mockResolvedValue(true)
      })
    })

    it('saves event to firebase', async () => {
      await wrapper.vm.save_event()
      expect(firebase.collection).toHaveBeenCalled()
    })

    it('handles save errors', async () => {
      const error = new Error('Save failed')
      firebase.collection().set.mockRejectedValueOnce(error)
      await wrapper.vm.save_event()
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      await wrapper.vm.validate_form()
      expect(wrapper.vm.is_valid).toBe(false)
    })

    it('shows validation errors', async () => {
      await wrapper.vm.validate_form()
      expect(wrapper.vm.error).toBeTruthy()
    })
  })
})
