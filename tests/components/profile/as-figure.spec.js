import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import { vi } from 'vitest'
import { ref } from 'vue'
import as_figure from '@/components/profile/as-figure'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+16282281824'
  }
})

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useRoute: () => ({
    path: '/test-path'
  })
}))

// Mock the use/people composable
vi.mock('@/use/people', async () => {
  const { ref } = await import('vue')
  return {
    use_me: () => ({
      me: ref(null),
      relations: ref([])
    }),
    is_person: maybe => {
      if (typeof maybe !== 'object') return false
      if (maybe.type !== 'person') return false
      if (!maybe.id) return false
      return true
    }
  }
})

describe('@/component/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    get.mockImplementation(() => Promise.resolve({}))
    person = {
      name: 'Scott Fryxell',
      id: '/+16282281823',
      type: 'person'
    }
    wrapper = shallowMount(as_figure, {
      props: {
        person
      },
      global: {
        stubs: {
          'as-svg': true,
          icon: true,
          'profile-as-meta': true,
          'as-relationship-options': true,
          'as-address': true,
          'as-messenger': true
        }
      }
    })
  })
  describe('Renders', () => {
    it("Render a person's profile info", () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('figure.profile').exists()).toBe(true)
      expect(wrapper.find('figcaption').exists()).toBe(true)
    })
    it('renders label when display=label', () => {
      wrapper = shallowMount(as_figure, {
        props: { person, display: 'label' },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': {
              template: '<a :href="to"><slot /></a>',
              props: ['to']
            }
          }
        }
      })
      const link = wrapper.find('.profile.label')
      expect(link.exists()).toBe(true)
      expect(link.find('span').text()).toBe('Scott Fryxell')
      expect(link.attributes('href')).toBe(person.id)
    })
    it('renders avatar in label when person has avatar', () => {
      const person_with_avatar = {
        ...person,
        avatar: '/+16282281823/posters/123'
      }
      wrapper = shallowMount(as_figure, {
        props: { person: person_with_avatar, display: 'label' },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'as-poster-symbol': true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.exists()).toBe(true)
      expect(as_svg.attributes('itemid')).toBe(person_with_avatar.avatar)
    })
    it('renders poster_itemid in label when no avatar', () => {
      wrapper = shallowMount(as_figure, {
        props: {
          person,
          display: 'label',
          poster_itemid: '/+16282281823/posters/456'
        },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'as-poster-symbol': true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.exists()).toBe(true)
      expect(as_svg.attributes('itemid')).toBe('/+16282281823/posters/456')
    })
    it('renders avatar when display=label and person has avatar', () => {
      person.avatar = '/+16282281823/posters/123'
      wrapper = shallowMount(as_figure, {
        props: { person, display: 'label' },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.attributes('itemid')).toBe(person.avatar)
    })
    it('renders poster fallback when display=label, no avatar, poster_itemid provided', () => {
      const poster_id = '/+16282281823/posters/456'
      wrapper = shallowMount(as_figure, {
        props: { person, display: 'label', poster_itemid: poster_id },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.attributes('itemid')).toBe(poster_id)
    })
    it('renders avatar when display=label and person has avatar', () => {
      person.avatar = '/+16282281823/posters/123'
      wrapper = shallowMount(as_figure, {
        props: { person, display: 'label' },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.attributes('itemid')).toBe(person.avatar)
    })
    it('renders poster when display=label and no avatar but poster_itemid', () => {
      wrapper = shallowMount(as_figure, {
        props: {
          person: { ...person },
          display: 'label',
          poster_itemid: '/+16282281823/posters/456'
        },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.attributes('itemid')).toBe('/+16282281823/posters/456')
    })
    it('renders as-svg with poster_itemid when display=label and no avatar', () => {
      const person_no_avatar = { name: 'Test', id: '/+1', type: 'person' }
      wrapper = shallowMount(as_figure, {
        props: {
          person: person_no_avatar,
          display: 'label',
          poster_itemid: '/+1/posters/123'
        },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.exists()).toBe(true)
      expect(as_svg.attributes('itemid')).toBe('/+1/posters/123')
    })

    it('renders as-svg with poster_itemid when display=label and no avatar', () => {
      const person_no_avatar = { ...person, avatar: undefined }
      wrapper = shallowMount(as_figure, {
        props: {
          person: person_no_avatar,
          display: 'label',
          poster_itemid: '/+16282281823/posters/123'
        },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.exists()).toBe(true)
      expect(as_svg.attributes('itemid')).toBe('/+16282281823/posters/123')
    })
    it('renders as-svg with poster_itemid when display=label and no avatar', () => {
      const person_no_avatar = { ...person, avatar: undefined }
      wrapper = shallowMount(as_figure, {
        props: {
          person: person_no_avatar,
          display: 'label',
          poster_itemid: '/+16282281823/posters/123'
        },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'router-link': { template: '<a><slot /></a>', props: ['to'] }
          }
        }
      })
      const as_svg = wrapper.find('as-svg-stub')
      expect(as_svg.exists()).toBe(true)
      expect(as_svg.attributes('itemid')).toBe('/+16282281823/posters/123')
    })
    it('renders full profile when display=phonebook', () => {
      wrapper = shallowMount(as_figure, {
        props: { person, display: 'phonebook' },
        global: {
          stubs: {
            'as-svg': true,
            icon: true,
            'profile-as-meta': true,
            'as-relationship-options': true,
            'as-address': true,
            'as-messenger': true
          }
        }
      })
      expect(wrapper.find('figure.profile').exists()).toBe(true)
    })
  })
})
