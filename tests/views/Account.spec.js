import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import Account from '@/views/Account.vue'

const { mock_replace, mock_me, mock_current_user, mock_is_valid_name } =
  vi.hoisted(() => {
    const create_ref = value => ({ value, __v_isRef: true })
    return {
      mock_replace: vi.fn(),
      mock_me: create_ref(undefined),
      mock_current_user: create_ref(undefined),
      mock_is_valid_name: create_ref(true)
    }
  })

const mock_route = reactive({ query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user
}))

vi.mock('@/utils/serverless-auth', () => ({
  sign_off: vi.fn()
}))

vi.mock('@/use/people', () => ({
  use_me: () => ({ is_valid_name: mock_is_valid_name }),
  is_person: vi.fn(() => true),
  name_error: vi.fn(() => null)
}))

vi.mock('@/components/preferences-menu', () => ({
  default: {
    name: 'PreferencesMenu',
    template: '<menu class="preferences-menu-stub" />'
  }
}))

const default_stubs = {
  'logo-as-link': true,
  icon: true,
  'as-address': {
    name: 'AsAddress',
    template: '<address class="as-address-stub"><slot /></address>',
    props: ['person']
  },
  // Keyed by the component's own name, not the local import alias — the alias
  // never matched, so the old `name-as-form` stub was dead config.
  'as-form-name': {
    name: 'AsFormName',
    template: '<form class="name-as-form-stub" />'
  }
}

const mount = () => shallowMount(Account, { global: { stubs: default_stubs } })

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = { id: '/+15550000000', name: 'Scott', type: 'person' }
    mock_current_user.value = { uid: 'test-user' }
    mock_is_valid_name.value = true
  })

  it('renders the account section when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('section#account[data-page]').exists()).toBe(true)
  })

  it('offers neither account action while auth is unresolved', () => {
    mock_current_user.value = undefined
    const wrapper = mount()
    expect(wrapper.find('#sign-out').exists()).toBe(false)
    expect(wrapper.find('#sign-in').exists()).toBe(false)
  })

  it('shows the name field when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('.name-as-form-stub').exists()).toBe(true)
  })

  it('shows the name field when signed out too', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('.name-as-form-stub').exists()).toBe(true)
  })

  it('offers sign in rather than sign out when signed out', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('#sign-in').exists()).toBe(true)
    expect(wrapper.find('#sign-out').exists()).toBe(false)
    expect(mock_replace).not.toHaveBeenCalled()
  })

  it('sends Sign in to the sign-on page, never a dialog', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('#sign-in').attributes('to')).toBe('/sign-on')
    expect(wrapper.find('dialog#sign-on').exists()).toBe(false)
  })

  it('shows the sync folder preference when not signed in', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('preference-stub').exists()).toBe(true)
  })

  it('nests the SVG preference inside sync folder', () => {
    const wrapper = shallowMount(Account, {
      global: {
        stubs: {
          ...default_stubs,
          Preference: false
        }
      }
    })
    const sync_folder = wrapper
      .findAllComponents({ name: 'Preference' })
      .find(c => c.props('name') === 'sync_folder')
    expect(sync_folder).toBeTruthy()
    const nested = sync_folder
      .findAllComponents({ name: 'Preference' })
      .find(c => c.props('name') === 'sync_svg')
    expect(nested).toBeTruthy()
  })
})
