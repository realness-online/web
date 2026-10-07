import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vite-plus/test'
import { ref } from 'vue'
import wipe from '@/components/account/as-fieldset-wipe'

const { mock_keys, mock_clear } = vi.hoisted(() => {
  return {
    mock_keys: vi.fn(),
    mock_clear: vi.fn()
  }
})

const mock_current_user_ref = ref(null)

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return mock_current_user_ref
  }
}))

vi.mock('idb-keyval', () => ({
  keys: mock_keys,
  clear: mock_clear
}))

describe('@/components/account/as-fieldset-wipe', () => {
  let wrapper

  beforeEach(async () => {
    vi.clearAllMocks()
    mock_keys.mockResolvedValue([])
    mock_current_user_ref.value = null

    localStorage.clear()
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    })

    wrapper = await shallowMount(wipe)
    await flushPromises()
  })

  describe('#cleanable', () => {
    it('stays hidden when nothing is stored', () => {
      expect(wrapper.find('fieldset').exists()).toBe(false)
    })

    it('offers the row when a stale profile is stored', async () => {
      localStorage.me = '/+123'
      wrapper = await shallowMount(wipe)
      await flushPromises()

      expect(wrapper.find('button#wipe').exists()).toBe(true)
    })

    it('stays hidden while signed in', async () => {
      localStorage.me = '/+123'
      mock_current_user_ref.value = { uid: 'test-user' }
      wrapper = await shallowMount(wipe)
      await flushPromises()

      expect(wrapper.find('fieldset').exists()).toBe(false)
    })
  })

  describe('#on_wipe', () => {
    it('clears localStorage and redirects', async () => {
      localStorage.setItem('test1', 'value1')
      localStorage.setItem('test2', 'value2')
      localStorage.me = '/+123'

      await wrapper.vm.on_wipe()
      await flushPromises()

      expect(localStorage.me).toBe('/+')
      expect(localStorage.getItem('test1')).toBeFalsy()
      expect(localStorage.getItem('test2')).toBeFalsy()
      expect(mock_clear).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })

    it('removes every key even with many entries present', async () => {
      for (let i = 0; i < 20; i++) localStorage.setItem(`key${i}`, `value${i}`)
      localStorage.me = '/+123'

      await wrapper.vm.on_wipe()
      await flushPromises()

      for (let i = 0; i < 20; i++)
        expect(localStorage.getItem(`key${i}`)).toBeFalsy()
    })
  })

  describe('#on_ask_wipe', () => {
    it('opens the confirmation before anything is cleared', async () => {
      localStorage.me = '/+123'
      wrapper = await shallowMount(wipe, { attachTo: document.body })
      await flushPromises()

      const dialog = document.querySelector('dialog#confirm-wipe')
      dialog.showModal = vi.fn()

      await wrapper.find('button#wipe').trigger('click')

      expect(dialog.showModal).toHaveBeenCalled()
      expect(mock_clear).not.toHaveBeenCalled()
    })
  })
})
