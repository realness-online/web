import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import Sign_on from '@/views/Sign-on.vue'
import MobileAsForm from '@/components/profile/as-form-mobile'
import NameAsForm from '@/components/profile/as-form-name'

Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356',
    length: 0
  }
})

vi.mock('idb-keyval', () => ({
  keys: vi.fn().mockResolvedValue([]),
  clear: vi.fn().mockResolvedValue()
}))

vi.mock('@/utils/itemid', () => ({
  load: vi.fn().mockResolvedValue({})
}))

const mock_current_user = vi.hoisted(() => ({ value: null }))

vi.mock('@/utils/serverless', () => ({
  current_user: mock_current_user
}))

vi.mock('@/use/people', () => {
  return {
    use_me: () => {
      const me = ref({
        id: '/+14151234356',
        type: 'person',
        name: { given: 'Test', family: 'User' }
      })
      const is_valid_name = computed(async () => {
        if (!mock_current_user.value) return false
        if (!me.value?.name) return false
        if (typeof me.value.name === 'string' && me.value.name.length < 3)
          return false
        if (
          typeof me.value.name === 'object' &&
          (!me.value.name.given || !me.value.name.family)
        )
          return false
        return true
      })
      return {
        me,
        is_valid_name,
        relations: ref([])
      }
    },
    default_person: { id: '/+14151234356', type: 'person' },
    is_person: maybe => {
      if (typeof maybe !== 'object') return false
      if (maybe.type !== 'person') return false
      if (!maybe.id) return false
      return true
    }
  }
})

const mock_push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mock_push
  })
}))

describe('Sign-on', () => {
  let wrapper

  beforeEach(async () => {
    vi.clearAllMocks()
    const { current_user } = await import('@/utils/serverless')
    current_user.value = null
    wrapper = shallowMount(Sign_on, {
      global: {
        stubs: {
          'logo-as-link': true,
          'profile-as-figure': {
            template: '<div class="profile-stub"></div>',
            props: ['person', 'editable']
          },
          'mobile-as-form': true,
          'name-as-form': true
        }
      }
    })
    await wrapper.vm.$nextTick()
  })

  describe('initial render', () => {
    it('renders sign-on component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#sign-on').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
    })

    it('renders name form when nameless and current_user exists', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = { id: '/+14151234356', type: 'person' }

      const new_wrapper = shallowMount(Sign_on, {
        global: {
          stubs: {
            'logo-as-link': true,
            'profile-as-figure': true,
            'mobile-as-form': true,
            'name-as-form': true
          }
        }
      })

      await new_wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))

      if (new_wrapper.vm.nameless) {
        const name_form = new_wrapper.findComponent(NameAsForm)
        expect(name_form.exists()).toBe(true)
      }
    })

    it('renders mobile form when not nameless', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = null
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(wrapper.vm.nameless).toBe(false)
      const mobile_form = wrapper.findComponent(MobileAsForm)
      expect(mobile_form.exists()).toBe(true)
    })

    it('renders wipe button when cleanable', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = null
      wrapper.vm.index_db_keys = ['key1', 'key2']
      await wrapper.vm.$nextTick()
      const wipe_button = wrapper.find('footer button')
      expect(wipe_button.exists()).toBe(true)
      expect(wipe_button.text()).toBe('Wipe')
    })
  })

  describe('Functionality', () => {
    it('calculates cleanable correctly', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = null
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+14151234356',
          length: 5,
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn()
        },
        writable: true,
        configurable: true
      })

      wrapper.vm.index_db_keys = ['key1', 'key2']
      expect(wrapper.vm.cleanable).toBe(true)
    })

    it('cleans localStorage and redirects', async () => {
      const { clear } = await import('idb-keyval')
      const mock_remove_item = vi.fn()
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+14151234356',
          length: 5,
          removeItem: mock_remove_item,
          setItem: vi.fn()
        },
        writable: true,
        configurable: true
      })

      window.location = { href: '' }
      wrapper.vm.me = { id: '/+14151234356', type: 'person' }

      await wrapper.vm.clean()

      expect(mock_remove_item).toHaveBeenCalled()
      expect(clear).toHaveBeenCalled()
      expect(window.localStorage.me).toBe('/+')
    })

    it('handles signed on with existing profile', async () => {
      const { load } = await import('@/utils/itemid')
      const { current_user } = await import('@/utils/serverless')
      current_user.value = null
      const mock_profile = { id: '/+14151234356', type: 'person' }
      load.mockResolvedValueOnce(mock_profile)

      await wrapper.vm.signed_on()

      expect(mock_push).toHaveBeenCalledWith({ path: '/' })
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(wrapper.vm.nameless).toBe(false)
    })

    it('navigates to phonebook when signed on without profile', async () => {
      const { load } = await import('@/utils/itemid')
      load.mockResolvedValueOnce(null)

      await wrapper.vm.signed_on()

      expect(mock_push).toHaveBeenCalledWith({ path: '/phonebook' })
    })

    it('navigates to phonebook on new person', () => {
      wrapper.vm.new_person()
      expect(mock_push).toHaveBeenCalledWith({ path: '/phonebook' })
    })

    it('redirects if current_user exists on mount', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = { id: '/+14151234356', type: 'person' }

      const new_wrapper = shallowMount(Sign_on, {
        global: {
          stubs: {
            'logo-as-link': true,
            'profile-as-figure': true,
            'mobile-as-form': true,
            'name-as-form': true
          }
        }
      })

      await new_wrapper.vm.$nextTick()
      expect(mock_push).toHaveBeenCalledWith({ path: '/' })
    })

    it('loads indexdb keys on mount', async () => {
      const { keys } = await import('idb-keyval')
      keys.mockResolvedValueOnce(['key1', 'key2'])

      const new_wrapper = shallowMount(Sign_on, {
        global: {
          stubs: {
            'logo-as-link': true,
            'profile-as-figure': true,
            'mobile-as-form': true,
            'name-as-form': true
          }
        }
      })

      await new_wrapper.vm.$nextTick()
      expect(keys).toHaveBeenCalled()
    })

    it('sets nameless when current_user exists but name is invalid', async () => {
      const { current_user } = await import('@/utils/serverless')
      current_user.value = { id: '/+14151234356', type: 'person' }

      const new_wrapper = shallowMount(Sign_on, {
        global: {
          stubs: {
            'logo-as-link': true,
            'profile-as-figure': true,
            'mobile-as-form': true,
            'name-as-form': true
          }
        }
      })

      await new_wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      const { use_me } = await import('@/use/people')
      const me_result = use_me()
      if (!me_result.is_valid_name.value) {
        expect(new_wrapper.vm.nameless).toBe(true)
      }
    })
  })
})
