import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsDays from '@/components/as-days.vue'

vi.mock('@/utils/sorting', () => ({
  recent_date_first: vi.fn()
}))

vi.mock('@/utils/itemid', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    as_author: vi.fn(id => {
      const m = String(id).match(/^(\/\+[^/]+)/)
      return m ? m[1] : '/+16282281824'
    }),
    as_created_at: vi.fn(id => {
      const parts = String(id).split('/')
      const last = parts[parts.length - 1]
      const n = parseInt(last, 10)
      return Number.isFinite(n) ? n : null
    })
  }
})

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
        statements: [],
        posters: [],
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
      expect(wrapper.find('section[data-days]').exists()).toBe(true)
    })

    it('shows working indicator when working prop is true', async () => {
      await wrapper.setProps({ working: true })
      expect(wrapper.find('header svg').exists()).toBe(true)
    })

    it('renders day articles when not working', () => {
      expect(wrapper.find('section[data-days]').exists()).toBe(true)
    })

    // role="feed" only allows article children, and the pagination sentinel is
    // not one. A valueless `aria-hidden` compiles to the empty string, which is
    // not a valid value — the div stays in the accessibility tree and the feed
    // fails aria-required-children. It has to say true out loud.
    it('hides the pagination sentinel from the accessibility tree', () => {
      const sentinel = wrapper.find('[data-feed-end]')
      expect(sentinel.exists()).toBe(true)
      expect(sentinel.attributes('aria-hidden')).toBe('true')
    })
  })

  describe('Props', () => {
    it('accepts statements prop', () => {
      const statements = [{ id: '/+16282281824/statements/123' }]
      wrapper = shallowMount(AsDays, {
        props: { statements }
      })
      expect(wrapper.props('statements')).toEqual(statements)
    })

    it('accepts posters prop', () => {
      const posters = [{ id: '/+16282281824/posters/123' }]
      wrapper = shallowMount(AsDays, {
        props: { posters }
      })
      expect(wrapper.props('posters')).toEqual(posters)
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
      expect(wrapper.vm.filtered_days_list).toBeDefined()
    })

    it('has thought_feed_slots_list computed property', () => {
      expect(wrapper.vm.thought_feed_slots_list).toBeDefined()
    })

    // Regression: editing a statement keeps its id, so a refill signature that
    // only watches ids never fires and the rendered thought stays stale until
    // reload. Content changes must also refill the days map.
    it('refills days when statement content changes but its id does not', async () => {
      const stmt = {
        id: '/+16282281824/statements/100',
        type: 'thoughts',
        statement: 'before'
      }
      wrapper = shallowMount(AsDays, {
        props: { statements: [stmt], posters: [], paginate: false },
        global: { stubs: { icon: false } },
        slots: {
          default: ({ day }) => day[0][0].statement
        }
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('before')

      // Same id, new content — as `update_statement` produces in statements.js.
      await wrapper.setProps({
        statements: [{ ...stmt, statement: 'after' }]
      })
      expect(wrapper.text()).toContain('after')
    })
  })

  describe('storytelling flattened_items', () => {
    const thought = {
      id: '/+16282281824/statements/100',
      type: 'thoughts',
      statement: 'plain text'
    }

    it('omits text thought trains; keeps posters', () => {
      const poster = {
        id: '/+16282281824/posters/200',
        type: 'posters'
      }
      wrapper = shallowMount(AsDays, {
        props: {
          statements: [thought],
          posters: [poster],
          paginate: false,
          working: false,
          storytelling: true
        },
        global: { stubs: { icon: false } }
      })
      const slides = wrapper.findAll('section[data-days] article > section')
      expect(slides).toHaveLength(1)
    })

    it('omits all slides when only text thoughts exist', () => {
      wrapper = shallowMount(AsDays, {
        props: {
          statements: [thought],
          posters: [],
          paginate: false,
          working: false,
          storytelling: true
        },
        global: { stubs: { icon: false } }
      })
      const slides = wrapper.findAll('section[data-days] article > section')
      expect(slides).toHaveLength(0)
    })
  })
})
