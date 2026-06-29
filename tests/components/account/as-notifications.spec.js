import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsNotifications from '@/components/account/as-notifications.vue'

const { mock_status, mock_busy, mock_enable, mock_disable, mock_refresh,
       mock_notifications } =
  vi.hoisted(() => {
    const create_ref = value => ({ value, __v_isRef: true })
    const mock_notifications = create_ref(false)
    return {
      mock_status: create_ref('off'),
      mock_busy: create_ref(false),
      mock_notifications,
      mock_enable: vi.fn().mockResolvedValue(true),
      mock_disable: vi.fn().mockResolvedValue(true),
      mock_refresh: vi.fn().mockResolvedValue(undefined)
    }
  })

vi.mock('@/use/push', () => ({
  use_push: () => ({
    supported: true,
    status: mock_status,
    busy: mock_busy,
    refresh: mock_refresh,
    enable: mock_enable,
    disable: mock_disable
  })
}))

vi.mock('@/utils/preference', () => ({
  notifications: mock_notifications
}))

const mount = () => shallowMount(AsNotifications)

describe('@/components/account/as-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_status.value = 'off'
    mock_busy.value = false
  })

  it('refreshes state on mount', () => {
    mount()
    expect(mock_refresh).toHaveBeenCalled()
  })

  it('renders nothing when push is unsupported', () => {
    mock_status.value = 'unsupported'
    const wrapper = mount()
    expect(wrapper.find('.as-notifications').exists()).toBe(false)
  })

  it('checks the toggle when notifications are on', () => {
    mock_notifications.value = true
    const wrapper = mount()
    expect(wrapper.find('input[type="checkbox"]').element.checked).toBe(true)
  })

  it('disables and explains when blocked at the OS level', () => {
    mock_status.value = 'blocked'
    const wrapper = mount()
    expect(
      wrapper.find('input[type="checkbox"]').attributes('disabled')
    ).toBeDefined()
    expect(wrapper.find('small').text()).toMatch(/browser settings/i)
  })

  it('prompts to install first on iOS when not installed', () => {
    mock_status.value = 'needs-install'
    const wrapper = mount()
    expect(
      wrapper.find('input[type="checkbox"]').attributes('disabled')
    ).toBeDefined()
    expect(wrapper.find('small').text()).toMatch(/home screen/i)
  })

  it('enables when toggled on', async () => {
    mock_status.value = 'off'
    const wrapper = mount()
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(mock_enable).toHaveBeenCalled()
    expect(mock_disable).not.toHaveBeenCalled()
  })

  it('disables when toggled off', async () => {
    mock_status.value = 'on'
    const wrapper = mount()
    await wrapper.find('input[type="checkbox"]').setValue(false)
    expect(mock_disable).toHaveBeenCalled()
    expect(mock_enable).not.toHaveBeenCalled()
  })
})
