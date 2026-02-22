import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

// Mock localStorage BEFORE importing the module
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      me: '/+14151234356'
    },
    configurable: true,
    writable: true
  })
})

import {
  use,
  use_me,
  get_my_itemid,
  as_phone_number,
  from_e64,
  is_person
} from '@/use/people'

// Mock dependencies
vi.mock('@/utils/itemid', () => ({
  list: vi.fn(() => Promise.resolve([])),
  load: vi.fn(id => Promise.resolve({ id, type: 'person', loaded: true }))
}))

vi.mock('@/utils/serverless', () => ({
  current_user: ref({ uid: 'test-user' }),
  me: ref({
    id: '/+14151234356',
    name: 'Scott Fryxell',
    type: 'person'
  }),
  directory: vi.fn(() =>
    Promise.resolve({
      prefixes: [{ name: '+14151234356' }, { name: '+14155551234' }]
    })
  )
}))

vi.mock('@/utils/sorting', () => ({
  recent_visit_first: vi.fn((a, b) => 0)
}))

vi.mock('@/persistance/Storage', () => ({
  Me: vi.fn().mockImplementation(() => ({
    save: vi.fn()
  }))
}))

// Helper to test composables in proper Vue context
function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return result
}

describe('people composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('use()', () => {
    it('initializes with empty people and phonebook arrays', () => {
      const { people, phonebook } = with_setup(use)
      expect(people.value).toEqual([])
      expect(phonebook.value).toEqual([])
    })

    it('person computed returns first person in array', () => {
      const { people, person, load_person } = with_setup(use)
      expect(person.value).toBeUndefined()

      people.value.push({ id: '/+1234', name: 'Test' })
      expect(person.value).toEqual({ id: '/+1234', name: 'Test' })
    })

    it('load_person adds person to people array', async () => {
      const { people, load_person } = with_setup(use)
      await load_person({ id: '/+1234' })

      expect(people.value).toHaveLength(1)
      expect(people.value[0].id).toBe('/+1234')
      expect(people.value[0].loaded).toBe(true)
    })

    it('load_people loads multiple people', async () => {
      const { people, load_people } = with_setup(use)
      await load_people([{ id: '/+1234' }, { id: '/+5678' }])

      expect(people.value).toHaveLength(2)
    })
  })

  describe('use_me()', () => {
    it('returns me ref with current user data', () => {
      const { me } = use_me()
      expect(me.value).toEqual({
        id: '/+14151234356',
        name: 'Scott Fryxell',
        type: 'person'
      })
    })

    it('save function creates Me instance and calls save', async () => {
      const me_el = document.createElement('div')
      me_el.setAttribute('itemid', '/+14151234356')
      document.body.appendChild(me_el)
      const { save } = use_me()
      await save()
      const { Me } = await import('@/persistance/Storage')
      expect(Me).toHaveBeenCalled()
      document.body.removeChild(me_el)
    })

    it('returns relations ref', () => {
      const { relations } = use_me()
      expect(relations).toBeDefined()
    })
  })

  describe('helper functions', () => {
    describe('get_my_itemid', () => {
      it('returns localStorage.me when no type provided', () => {
        expect(get_my_itemid()).toBe('/+14151234356')
      })

      it('appends type to localStorage.me', () => {
        expect(get_my_itemid('posters')).toBe('/+14151234356/posters')
        expect(get_my_itemid('thoughts')).toBe('/+14151234356/thoughts')
      })
    })

    describe('as_phone_number', () => {
      it('removes leading /+ from id', () => {
        expect(as_phone_number('/+14151234356')).toBe('14151234356')
        expect(as_phone_number('/+15555551234')).toBe('15555551234')
      })

      it('handles default value', () => {
        expect(as_phone_number()).toBe('1')
      })
    })

    describe('from_e64', () => {
      it('prepends / to e64 number', () => {
        expect(from_e64('+14151234356')).toBe('/+14151234356')
        expect(from_e64('+15555551234')).toBe('/+15555551234')
      })
    })

    describe('is_person', () => {
      it('returns false for non-objects and primitives', () => {
        expect(is_person('string')).toBe(false)
        expect(is_person(123)).toBe(false)
      })

      it('returns false when type is not person', () => {
        expect(is_person({ id: '/test', type: 'poster' })).toBe(false)
      })

      it('returns false when id is missing', () => {
        expect(is_person({ type: 'person' })).toBe(false)
      })

      it('returns true for valid person objects', () => {
        expect(is_person({ id: '/+1234', type: 'person' })).toBe(true)
        expect(is_person({ id: '/+1234', type: 'person', name: 'Test' })).toBe(
          true
        )
      })
    })
  })
})
