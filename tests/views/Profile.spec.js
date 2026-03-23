import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import Profile from '@/views/Profile.vue'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

const {
  mock_people,
  mock_person,
  mock_statements,
  mock_posters,
  mock_load_person,
  mock_statements_for_person,
  mock_posters_for_person
} = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_people: create_ref([{ id: '/+15550000000', type: 'person' }]),
    mock_person: create_ref({ id: '/+15550000000', type: 'person' }),
    mock_statements: create_ref([
      { id: '/+15550000000/statements/1', type: 'thoughts' }
    ]),
    mock_posters: create_ref([
      { id: '/+15550000000/posters/1', type: 'posters' }
    ]),
    mock_load_person: vi.fn().mockResolvedValue(undefined),
    mock_statements_for_person: vi.fn().mockResolvedValue(undefined),
    mock_posters_for_person: vi.fn().mockResolvedValue(undefined)
  }
})

let mock_route = reactive({
  params: { phone_number: '4151234356' }
})

vi.mock('vue-router', () => ({
  useRoute: () => mock_route
}))

// Mock people composable
vi.mock('@/use/people', () => ({
  use: () => ({
    people: mock_people,
    person: mock_person,
    load_people: vi.fn(),
    load_person: mock_load_person
  }),
  from_e64: vi.fn(phone_number => `/${phone_number}`),
  is_person: maybe => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))

// Mock statements composable
vi.mock('@/use/statements', () => ({
  use: () => ({
    statements: mock_statements,
    statement_shown: vi.fn(),
    for_person: mock_statements_for_person
  }),
  slot_key: vi.fn()
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: mock_posters,
    for_person: mock_posters_for_person
  }),
  geology_layers: [],
  is_vector_id: vi.fn().mockReturnValue(true),
  is_svg_valid: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

describe('Profile', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mock_route = reactive({
      params: { phone_number: '4151234356' }
    })
    mock_route.params.phone_number = '4151234356'
    mock_people.value = [{ id: '/+15550000000', type: 'person' }]
    mock_person.value = { id: '/+15550000000', type: 'person' }
    mock_statements.value = [
      { id: '/+15550000000/statements/1', type: 'thoughts' }
    ]
    mock_posters.value = [{ id: '/+15550000000/posters/1', type: 'posters' }]
    wrapper = shallowMount(Profile, {
      global: {
        stubs: {
          'as-days': true,
          'logo-as-link': true,
          'download-vector': true,
          'as-figure': true,
          'as-svg': true,
          'as-messenger': true,
          'thought-as-article': true,
          'poster-as-figure': true,
          icon: true,
          'router-link': true
        }
      }
    })
  })

  it('renders profile view', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#profile').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
    })
  })

  it('loads requested profile and resets stale feed state', async () => {
    await Promise.resolve()
    await nextTick()
    expect(mock_posters.value).toEqual([])
    expect(mock_statements.value).toEqual([])
    expect(mock_people.value).toEqual([])
    expect(mock_load_person).toHaveBeenCalledWith({ id: '/4151234356' })
    expect(mock_posters_for_person).toHaveBeenCalledWith({ id: '/4151234356' })
    expect(mock_statements_for_person).toHaveBeenCalledWith({
      id: '/4151234356'
    })
  })

  it('reloads when route phone number changes', async () => {
    await Promise.resolve()
    await nextTick()
    mock_route.params.phone_number = '+12157765485'
    await nextTick()
    await Promise.resolve()
    expect(mock_load_person).toHaveBeenLastCalledWith({ id: '/+12157765485' })
    expect(mock_posters_for_person).toHaveBeenLastCalledWith({
      id: '/+12157765485'
    })
    expect(mock_statements_for_person).toHaveBeenLastCalledWith({
      id: '/+12157765485'
    })
  })
})
