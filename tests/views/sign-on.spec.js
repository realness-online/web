import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SignOn from '@/views/sign-on.vue'

const mock_current_user_ref = ref(null)

const {
  mock_replace,
  mock_route,
  mock_me,
  mock_save,
  mock_load,
  mock_load_from_network,
  mock_keys,
  mock_clear,
  mock_is_valid_name_value
} = vi.hoisted(() => ({
  mock_replace: vi.fn(),
  mock_route: { query: {} },
  mock_me: { value: undefined, __v_isRef: true },
  mock_save: vi.fn(),
  mock_load: vi.fn(),
  mock_load_from_network: vi.fn(),
  mock_keys: vi.fn(),
  mock_clear: vi.fn(),
  mock_is_valid_name_value: { value: false }
}))

const mock_is_valid_name = {
  get value() {
    return mock_is_valid_name_value.value
  },
  set value(val) {
    mock_is_valid_name_value.value = val
  }
}

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  get current_user() {
    return mock_current_user_ref
  }
}))

vi.mock('@/use/people', () => ({
  use_me: () => ({
    is_valid_name: mock_is_valid_name,
    save: mock_save
  })
}))

vi.mock('@/utils/itemid', () => ({
  load: mock_load,
  load_from_network: mock_load_from_network
}))

vi.mock('idb-keyval', () => ({
  keys: mock_keys,
  clear: mock_clear
}))

describe('@/views/sign-on', () => {
  let wrapper

  beforeEach(async () => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = undefined
    mock_keys.mockResolvedValue([])
    mock_load.mockResolvedValue(null)
    mock_load_from_network.mockResolvedValue(null)
    mock_is_valid_name_value.value = false
    mock_current_user_ref.value = null

    localStorage.clear()
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    })

    wrapper = shallowMount(SignOn, {
      global: {
        stubs: {
          'logo-as-link': true,
          icon: true,
          'mobile-as-form': true,
          'name-as-form': true
        }
      }
    })
    await flushPromises()
  })

  it('renders the sign-on page section', () => {
    expect(wrapper.find('section#sign-on.page').exists()).toBe(true)
  })

  describe('routing', () => {
    it('routes to ?next path after sign-in', async () => {
      mock_route.query = { next: '/account' }
      await wrapper.vm.on_signed_in()
      expect(mock_replace).toHaveBeenCalledWith('/account')
    })

    it('falls back to me.id when ?next is missing', async () => {
      mock_me.value = { id: '/+15550000000' }
      await wrapper.vm.on_signed_in()
      expect(mock_replace).toHaveBeenCalledWith('/+15550000000')
    })

    it('falls back to / when nothing is known', async () => {
      await wrapper.vm.on_signed_in()
      expect(mock_replace).toHaveBeenCalledWith('/')
    })

    it('ignores ?next that is not a path', async () => {
      mock_route.query = { next: 'https://evil.example' }
      mock_me.value = { id: '/+15550000000' }
      await wrapper.vm.on_signed_in()
      expect(mock_replace).toHaveBeenCalledWith('/+15550000000')
    })
  })

  describe('sign-in flow', () => {
    it('redirects when name_valid is called', async () => {
      await wrapper.vm.name_valid()
      await flushPromises()
      expect(mock_save).toHaveBeenCalled()
      expect(mock_replace).toHaveBeenCalledWith('/')
    })

    it('redirects when signed_on finds valid profile with valid name', async () => {
      const profile = { id: '/+123', name: 'Test' }
      mock_load_from_network.mockResolvedValue(profile)
      mock_is_valid_name.value = true
      localStorage.me = '/+123'

      await wrapper.vm.signed_on()
      await flushPromises()

      expect(mock_load_from_network).toHaveBeenCalledWith('/+123')
      expect(mock_replace).toHaveBeenCalledWith('/+123')
    })

    it('sets nameless when signed_on finds profile but name invalid', async () => {
      const profile = { id: '/+123' }
      mock_load_from_network.mockResolvedValue(profile)
      mock_is_valid_name.value = false
      mock_current_user_ref.value = { uid: 'test-user' }
      localStorage.me = '/+123'

      await wrapper.vm.signed_on()
      await flushPromises()

      expect(wrapper.vm.nameless).toBe(true)
      expect(mock_replace).not.toHaveBeenCalled()
    })

    it('sets nameless when signed_on finds no profile', async () => {
      mock_load_from_network.mockResolvedValue(null)
      mock_load.mockResolvedValue(null)
      mock_current_user_ref.value = { uid: 'test-user' }
      localStorage.me = '/+123'

      await wrapper.vm.signed_on()
      await flushPromises()

      expect(wrapper.vm.nameless).toBe(true)
    })
  })

  describe('#clean', () => {
    it('clears localStorage and redirects', async () => {
      localStorage.setItem('test1', 'value1')
      localStorage.setItem('test2', 'value2')
      localStorage.me = '/+123'

      await wrapper.vm.clean()
      await flushPromises()

      expect(localStorage.me).toBe('/+')
      expect(localStorage.getItem('test1')).toBeFalsy()
      expect(localStorage.getItem('test2')).toBeFalsy()
      expect(mock_clear).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })
  })
})
