import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Account from '@/views/Account.vue'

const { mock_replace, mock_me, mock_current_user, mock_record, sponsor_state } =
  vi.hoisted(() => {
    const create_ref = value => ({ value, __v_isRef: true })
    return {
      mock_replace: vi.fn(),
      mock_me: create_ref(undefined),
      mock_current_user: create_ref(undefined),
      mock_record: vi.fn().mockResolvedValue(false),
      sponsor_state: {
        sponsorships: create_ref([]),
        is_sponsor: create_ref(false),
        latest_sponsorship: create_ref(null)
      }
    }
  })

const mock_route = reactive({ query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user,
  sign_off: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  keys: vi.fn().mockResolvedValue([])
}))

vi.mock('@/use/sponsor', () => ({
  use_sponsor: () => ({
    sponsorships: sponsor_state.sponsorships,
    is_sponsor: sponsor_state.is_sponsor,
    latest_sponsorship: sponsor_state.latest_sponsorship,
    record_session: mock_record
  })
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
  'as-sponsor': true
}

const mount = () => shallowMount(Account, { global: { stubs: default_stubs } })

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = { id: '/+15550000000', name: 'Scott', type: 'person' }
    mock_current_user.value = { uid: 'test-user' }
    mock_record.mockResolvedValue(false)
  })

  it('renders the account section when signed in', () => {
    const wrapper = mount()
    expect(wrapper.find('section#account.page').exists()).toBe(true)
  })

  it('redirects to /sign-on when not signed in', () => {
    mock_current_user.value = null
    mount()
    expect(mock_replace).toHaveBeenCalledWith({
      path: '/sign-on',
      query: { next: '/account' }
    })
  })

  it('records the Stripe session_id and clears the query', async () => {
    mock_record.mockResolvedValue(true)
    mock_route.query = { sponsor: 'ok', session_id: 'cs_test_abc' }
    mount()
    await flushPromises()
    expect(mock_record).toHaveBeenCalledWith('cs_test_abc')
    expect(mock_replace).toHaveBeenCalledWith({ path: '/account' })
  })

  it('does nothing when the redirect query is missing', async () => {
    mount()
    await flushPromises()
    expect(mock_record).not.toHaveBeenCalled()
  })

  it('does not redirect when sponsor entry already existed', async () => {
    mock_record.mockResolvedValue(false)
    mock_route.query = { sponsor: 'ok', session_id: 'cs_test_abc' }
    mount()
    await flushPromises()
    expect(mock_record).toHaveBeenCalledWith('cs_test_abc')
    expect(mock_replace).not.toHaveBeenCalledWith({ path: '/account' })
  })
})
