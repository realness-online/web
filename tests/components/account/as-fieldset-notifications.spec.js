import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsFieldsetNotifications from '@/components/account/as-fieldset-notifications.vue'

const {
  mock_status,
  mock_busy,
  mock_enable,
  mock_disable,
  mock_refresh,
  mock_notifications,
  mock_ready,
  mock_push_available,
  mock_probe
} = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  const mock_notifications = create_ref(false)
  const mock_ready = create_ref(true)
  const mock_push_available = create_ref(true)
  return {
    mock_status: create_ref('off'),
    mock_busy: create_ref(false),
    mock_notifications,
    mock_ready,
    mock_push_available,
    mock_probe: vi
      .fn()
      .mockResolvedValue({ push: true, phone_integrity: false }),
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

vi.mock('@/use/instance-capabilities', () => ({
  use_instance_capabilities: () => ({
    ready: mock_ready,
    push: mock_push_available,
    probe: mock_probe
  })
}))

vi.mock('@/utils/preference', () => ({
  notifications: mock_notifications
}))

const mount = () => shallowMount(AsFieldsetNotifications)

describe('@/components/account/as-fieldset-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_status.value = 'off'
    mock_busy.value = false
    mock_notifications.value = false
    mock_ready.value = true
    mock_push_available.value = true
  })

  it('refreshes state on mount', async () => {
    const wrapper = mount()
    await wrapper.vm.$nextTick()
    expect(mock_probe).toHaveBeenCalled()
    expect(mock_refresh).toHaveBeenCalled()
  })

  it('renders nothing when push is unsupported', () => {
    mock_status.value = 'unsupported'
    const wrapper = mount()
    expect(wrapper.find('fieldset[data-preference]').exists()).toBe(false)
  })

  it('renders nothing when the instance has no push capability', () => {
    mock_push_available.value = false
    const wrapper = mount()
    expect(wrapper.find('fieldset[data-preference]').exists()).toBe(false)
  })

  it('clears the notifications preference when push is unavailable', async () => {
    mock_push_available.value = false
    mock_notifications.value = true
    mount()
    await vi.waitFor(() => {
      expect(mock_notifications.value).toBe(false)
    })
    expect(mock_refresh).not.toHaveBeenCalled()
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
    expect(wrapper.find('p[data-hint]').text()).toMatch(/browser settings/i)
  })

  it('prompts to install first on iOS when not installed', () => {
    mock_status.value = 'needs-install'
    const wrapper = mount()
    expect(
      wrapper.find('input[type="checkbox"]').attributes('disabled')
    ).toBeDefined()
    expect(wrapper.find('p[data-hint]').text()).toMatch(/home screen/i)
  })

  it('enables when toggled on', async () => {
    mock_status.value = 'off'
    const wrapper = mount()
    await vi.waitFor(() => expect(mock_probe).toHaveBeenCalled())
    mock_enable.mockClear()
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(mock_enable).toHaveBeenCalled()
    expect(mock_disable).not.toHaveBeenCalled()
  })

  it('disables when toggled off', async () => {
    mock_status.value = 'on'
    const wrapper = mount()
    await vi.waitFor(() => expect(mock_probe).toHaveBeenCalled())
    mock_disable.mockClear()
    await wrapper.find('input[type="checkbox"]').setValue(false)
    expect(mock_disable).toHaveBeenCalled()
    expect(mock_enable).not.toHaveBeenCalled()
  })
})
