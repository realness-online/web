import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import About from '@/views/About.vue'

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    about: false,
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
  },
  writable: true
})

// Mock environment variables via vite define
// These are handled by vite.config.js define block

// Mock key-commands composable
vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn()
  })
}))

// Mock poster composable
const mock_for_person = vi.fn().mockResolvedValue(undefined)
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: ref([
      {
        id: '/+14151234356/posters/1',
        type: 'posters'
      },
      {
        id: '/+14151234356/posters/2',
        type: 'posters'
      },
      {
        id: '/+14151234356/posters/3',
        type: 'posters'
      },
      {
        id: '/+14151234356/posters/4',
        type: 'posters'
      }
    ]),
    for_person: mock_for_person
  }),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

// Mock documentation inject
const mock_documentation = {
  value: {
    show: vi.fn()
  }
}

describe('About', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(About, {
      global: {
        provide: {
          documentation: mock_documentation
        },
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
          'call-to-action': true,
          'logo-as-link': true
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders about view', () => {
      // Normalize version in snapshot to ignore package version differences
      const element = wrapper.element.cloneNode(true)
      const version_span = element.querySelector('header nav a span')
      if (version_span) version_span.textContent = '2.0.0'
      expect(element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#about').exists()).toBe(true)
      expect(wrapper.find('section#about').classes()).toContain('page')
    })

    it('renders header with navigation', () => {
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('header nav').exists()).toBe(true)
    })

    it('renders hero section', () => {
      expect(wrapper.find('section.hero').exists()).toBe(true)
      expect(wrapper.find('section.hero h1').text()).toBe('Realness')
    })

    it('renders documentation link', () => {
      const doc_link = wrapper.find('a')
      expect(doc_link.exists()).toBe(true)
      expect(doc_link.text()).toContain('Documentation')
    })

    it('renders articles for different sections', () => {
      expect(wrapper.find('article.designers').exists()).toBe(true)
      expect(wrapper.find('article.networks').exists()).toBe(true)
      expect(wrapper.find('article.developers').exists()).toBe(true)
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
    it('sets sessionStorage.about to true on mount', () => {
      expect(window.sessionStorage.about).toBe(true)
    })

    it('calls for_person with admin ID on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_for_person).toHaveBeenCalledWith({
        id: import.meta.env.VITE_ADMIN_ID || '/+14151234356'
      })
    })

    it('shows documentation when link is clicked', async () => {
      const doc_link = wrapper.find('header nav a')
      expect(doc_link.exists()).toBe(true)
      await doc_link.trigger('click')
      expect(mock_documentation.value.show).toHaveBeenCalled()
    })

    it('renders posters when available', async () => {
      await wrapper.vm.$nextTick()
      const { use_posters } = await import('@/use/poster')
      const posters = use_posters().posters
      expect(posters.value.length).toBeGreaterThan(0)
      const poster_figures = wrapper.findAll('figure')
      expect(poster_figures.length).toBeGreaterThan(0)
    })
  })
})
