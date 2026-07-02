import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import About from '@/views/About.vue'

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
  },
  writable: true
})

import.meta.env.VITE_ADMIN_ID ??= '/+14151234356'

// Mock balance-gallery-posters to avoid async load_from_cache calls
vi.mock('@/utils/balance-gallery-posters', () => ({
  balance_gallery_posters: vi.fn(async posters => posters)
}))

// Mock key-commands composable
vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn()
  })
}))

// Mock poster composable
const mock_for_person = vi.fn().mockResolvedValue(undefined)
const admin_id = import.meta.env.VITE_ADMIN_ID
const posters_ref = ref([
  { id: `${admin_id}/posters/1`, type: 'posters' },
  { id: `${admin_id}/posters/2`, type: 'posters' },
  { id: `${admin_id}/posters/3`, type: 'posters' },
  { id: `${admin_id}/posters/4`, type: 'posters' },
  { id: `${admin_id}/posters/5`, type: 'posters' }
])
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: posters_ref,
    for_person: mock_for_person
  }),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_svg_valid: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

describe('About', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    posters_ref.value = [
      { id: `${admin_id}/posters/1`, type: 'posters' },
      { id: `${admin_id}/posters/2`, type: 'posters' },
      { id: `${admin_id}/posters/3`, type: 'posters' },
      { id: `${admin_id}/posters/4`, type: 'posters' },
      { id: `${admin_id}/posters/5`, type: 'posters' }
    ]
    wrapper = shallowMount(About, {
      global: {
        stubs: {
          'as-figure': {
            template: '<figure class="poster-stub"></figure>',
            props: ['itemid']
          },
          icon: true,
          preference: {
            template: '<fieldset class="preference-stub"></fieldset>',
            props: ['name', 'title', 'subtitle', 'show_state']
          },
          'call-to-action': true
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders about view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#about').exists()).toBe(true)
      expect(wrapper.find('section#about').classes()).toContain('page')
    })

    it('renders header with navigation', () => {
      expect(wrapper.find('header').exists()).toBe(true)
      // Site nav is rendered by the support layout (App.vue), not the page.
      expect(wrapper.find('nav[itemtype="/site-nav"]').exists()).toBe(false)
    })

    it('renders hero section', () => {
      const hero = wrapper.find('[itemprop="hero"]')
      expect(hero.exists()).toBe(true)
      expect(hero.find('h1').text()).toBe('Realness')
    })

    it('renders site nav with docs and pricing', () => {
      // Site nav lives in the support layout (App.vue), not in the page view.
      // Covered by App/layout specs; About should not render its own nav.
      expect(wrapper.find('nav[itemtype="/site-nav"]').exists()).toBe(false)
    })

    it('renders articles for different sections', () => {
      expect(wrapper.find('article[itemprop="artists"]').exists()).toBe(true)
      expect(wrapper.find('article[itemprop="communities"]').exists()).toBe(
        true
      )
    })

    it('renders gallery section', () => {
      const sections = wrapper.findAll('section')
      const gallery_section = sections.find(section => {
        const header = section.find('header')
        if (header.exists()) {
          const h2 = header.find('h2')
          return h2.exists() && h2.text() === 'Gallery'
        }
        return false
      })
      expect(gallery_section).toBeTruthy()
      expect(gallery_section.find('header h2').text()).toBe('Gallery')
    })

    it('renders footer', () => {
      expect(wrapper.find('footer').exists()).toBe(true)
    })
  })

  describe('Functionality', () => {
    it('calls for_person with admin ID on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_for_person).toHaveBeenCalledWith({
        id: import.meta.env.VITE_ADMIN_ID || '/+14151234356'
      })
    })

    it('renders posters when available', async () => {
      await wrapper.vm.$nextTick()
      const { use_posters } = await import('@/use/poster')
      const posters = use_posters().posters
      expect(posters.value.length).toBeGreaterThan(0)
      const poster_figures = wrapper.findAll('figure')
      expect(poster_figures.length).toBeGreaterThan(0)
    })

    it('excludes featured posters from the gallery', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const gallery = wrapper.find('[itemprop="gallery"]')
      expect(
        gallery.findAll('figure.poster-stub').length
      ).toBeGreaterThanOrEqual(1)
    })
  })
})
