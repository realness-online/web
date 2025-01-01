import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsDays from '@/components/as-days.vue'

const DAYS_IN_WEEK = 7
const WEEKS_TO_SHOW = 4
const SELECTED_DAY = 6

describe('@/components/as-days', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(AsDays)
  })

  describe('Calendar Display', () => {
    it('renders calendar grid', () => {
      const days = wrapper.findAll('.day')
      expect(days.length).toBe(DAYS_IN_WEEK * WEEKS_TO_SHOW)
    })

    it('shows current month', () => {
      const month = new Date().toLocaleString('default', { month: 'long' })
      expect(wrapper.text()).toContain(month)
    })
  })

  describe('Day Selection', () => {
    it('selects day on click', async () => {
      const day = wrapper.findAll('.day').at(0)
      await day.trigger('click')
      expect(wrapper.emitted('select-day')).toBeTruthy()
    })

    it('highlights selected day', async () => {
      await wrapper.setProps({ selected_date: new Date() })
      const selected = wrapper.find('.selected')
      expect(selected.exists()).toBe(true)
    })
  })

  describe('Navigation', () => {
    it('navigates to next month', async () => {
      const initial_month = wrapper.vm.current_month
      await wrapper.vm.next_month()
      expect(wrapper.vm.current_month).not.toBe(initial_month)
    })

    it('navigates to previous month', async () => {
      const initial_month = wrapper.vm.current_month
      await wrapper.vm.previous_month()
      expect(wrapper.vm.current_month).not.toBe(initial_month)
    })
  })

  describe('Date Utilities', () => {
    it('formats dates correctly', () => {
      const date = new Date()
      const formatted = wrapper.vm.format_date(date)
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('identifies today', () => {
      const today = new Date()
      expect(wrapper.vm.is_today(today)).toBe(true)
    })
  })
})
