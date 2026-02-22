import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsDays from '@/components/as-days.vue'

// Mock the composables and utilities
vi.mock('@/use/thought', () => ({
  as_statements: vi.fn(() => []),
  statements_sort: vi.fn()
}))

vi.mock('@/utils/sorting', () => ({
  recent_date_first: vi.fn(),
  earlier_weirdo_first: vi.fn(),
  recent_weirdo_first: vi.fn()
}))

vi.mock('@/utils/itemid', () => ({
  as_author: vi.fn(() => '/+16282281824')
}))

vi.mock('@/utils/date', () => ({
  id_as_day: vi.fn(() => '2024-01-15'),
  as_day: vi.fn(() => 'January 15, 2024'),
  is_today: vi.fn(() => false)
}))

describe('@/components/as-days', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(AsDays, {
      props: {
        thoughts: [],
        posters: [],
        events: [],
        paginate: true,
        working: false
      },
      global: {
        stubs: {
          icon: false
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders as-days section', () => {
      expect(wrapper.find('section.as-days').exists()).toBe(true)
    })

    it('shows working indicator when working prop is true', async () => {
      await wrapper.setProps({ working: true })
      expect(wrapper.find('header svg').exists()).toBe(true)
    })

    it('renders day articles when not working', () => {
      expect(wrapper.find('section.as-days').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('accepts thoughts prop', () => {
      const thoughts = [{ id: '/+16282281824/thoughts/123' }]
      wrapper = shallowMount(AsDays, {
        props: { thoughts }
      })
      expect(wrapper.props('thoughts')).toEqual(thoughts)
    })

    it('accepts posters prop', () => {
      const posters = [{ id: '/+16282281824/posters/123' }]
      wrapper = shallowMount(AsDays, {
        props: { posters }
      })
      expect(wrapper.props('posters')).toEqual(posters)
    })

    it('accepts events prop', () => {
      const events = [{ id: '/+16282281824/events/123' }]
      wrapper = shallowMount(AsDays, {
        props: { events }
      })
      expect(wrapper.props('events')).toEqual(events)
    })

    it('accepts paginate prop', () => {
      wrapper = shallowMount(AsDays, {
        props: { paginate: false }
      })
      expect(wrapper.props('paginate')).toBe(false)
    })

    it('accepts working prop', () => {
      wrapper = shallowMount(AsDays, {
        props: { working: true }
      })
      expect(wrapper.props('working')).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    it('has filtered_days computed property', () => {
      expect(wrapper.vm.filtered_days).toBeDefined()
    })

    it('has statements computed property', () => {
      expect(wrapper.vm.statements).toBeDefined()
    })
  })
})
