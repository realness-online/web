import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'
import sign_on from '@/components/profile/as-sign-on'

const {
  mock_save,
  mock_load,
  mock_load_from_network,
  mock_keys,
  mock_clear,
  mock_is_valid_name_value
} = vi.hoisted(() => {
  return {
    mock_save: vi.fn(),
    mock_load: vi.fn(),
    mock_load_from_network: vi.fn(),
    mock_keys: vi.fn(),
    mock_clear: vi.fn(),
    mock_is_valid_name_value: { value: false }
  }
})

const mock_is_valid_name = {
  get value() {
    return mock_is_valid_name_value.value
  },
  set value(val) {
    mock_is_valid_name_value.value = val
  }
}

vi.mock('@/use/people', () => ({
  use_me: () => ({
    is_valid_name: mock_is_valid_name,
    save: mock_save
  })
}))

const mock_current_user_ref = ref(null)

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return mock_current_user_ref
  }
}))

vi.mock('@/utils/itemid', () => ({
  load: mock_load,
  load_from_network: mock_load_from_network
}))

vi.mock('idb-keyval', () => ({
  keys: mock_keys,
  clear: mock_clear
}))

describe('@/components/profile/as-sign-on', () => {
  let wrapper

  beforeEach(async () => {
    vi.clearAllMocks()
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

    wrapper = await shallowMount(sign_on, {
      global: {
        stubs: {
          'mobile-as-form': true,
          'name-as-form': true
        }
      }
    })
    await flushPromises()
  })

  describe('Renders', () => {
    it('section with id sign-on', () => {
      expect(wrapper.find('section#sign-on').exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('emits showing_mobile on mount', async () => {
      await flushPromises()
      expect(wrapper.emitted('showing_mobile')).toBeTruthy()
      expect(wrapper.emitted('showing_mobile')[0]).toEqual([true])
    })

    it('emits signed_in when name_valid is called', async () => {
      await wrapper.vm.name_valid()
      await flushPromises()
      expect(mock_save).toHaveBeenCalled()
      expect(wrapper.emitted('signed_in')).toBeTruthy()
    })

    it('emits signed_in when signed_on finds valid profile with valid name', async () => {
      const profile = { id: '/+123', name: 'Test' }
      mock_load_from_network.mockResolvedValue(profile)
      mock_is_valid_name.value = true
      localStorage.me = '/+123'

      await wrapper.vm.signed_on()
      await flushPromises()

      expect(mock_load_from_network).toHaveBeenCalledWith('/+123')
      expect(wrapper.emitted('signed_in')).toBeTruthy()
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
      expect(wrapper.emitted('signed_in')).toBeFalsy()
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

  describe('Methods', () => {
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
})
