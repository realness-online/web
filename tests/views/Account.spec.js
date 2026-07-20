import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
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
  'name-as-form': true,
  'as-sign-on': {
    name: 'AsSignOn',
    template: '<section class="as-sign-on-stub" />'
  }
}

const mount = () => shallowMount(Account, { global: { stubs: default_stubs } })

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = { id: '/+15550000000', name: 'Scott', type: 'person' }
    mock_current_user.value = { uid: 'test-user' }
  })

  it('renders the account section when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('section#account[data-page]').exists()).toBe(true)
  })

  it('renders neither flow while auth is unresolved', () => {
    mock_current_user.value = undefined
    const wrapper = mount()
    expect(wrapper.find('.as-sign-on-stub').exists()).toBe(false)
    expect(wrapper.find('#sign-out').exists()).toBe(false)
  })

  it('shows the sign-in flow inline when not signed in (no redirect)', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('.as-sign-on-stub').exists()).toBe(true)
    expect(wrapper.find('#sign-out').exists()).toBe(false)
    expect(mock_replace).not.toHaveBeenCalled()
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

  it('redirects to the next query target after sign-in', async () => {
    mock_current_user.value = null
    mock_route.query = { next: '/discover' }
    const wrapper = mount()
    wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    await flushPromises()
    expect(mock_replace).toHaveBeenCalledWith('/discover')
  })
})
