import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

vi.unmock('@/components/profile/as-notification-prompt.vue')
import AsNotificationPrompt from '@/components/profile/as-notification-prompt.vue'

const {
  mock_busy,
  mock_enable,
  mock_refresh,
  mock_status,
  mock_notifications,
  mock_notifications_prompted,
  mock_push_available,
  mock_probe,
  mock_is_valid_name_value
} = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_busy: create_ref(false),
    mock_enable: vi.fn().mockResolvedValue(true),
    mock_refresh: vi.fn().mockResolvedValue(undefined),
    mock_status: create_ref('off'),
    mock_notifications: create_ref(false),
    mock_notifications_prompted: create_ref(false),
    mock_push_available: create_ref(true),
    mock_probe: vi
      .fn()
      .mockResolvedValue({ push: true, phone_integrity: false }),
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

vi.mock('@/use/push', () => ({
  use_push: () => ({
    status: mock_status,
    busy: mock_busy,
    refresh: mock_refresh,
    enable: mock_enable
  })
}))

vi.mock('@/use/people', () => ({
  use_me: () => ({
    is_valid_name: mock_is_valid_name
  })
}))

vi.mock('@/use/instance-capabilities', () => ({
  use_instance_capabilities: () => ({
    push: mock_push_available,
    probe: mock_probe
  })
}))

const current_user = ref(null)

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return current_user
  }
}))

vi.mock('@/utils/preference', () => ({
  notifications: mock_notifications,
  notifications_prompted: mock_notifications_prompted
}))

const mount = () =>
  shallowMount(AsNotificationPrompt, { attachTo: document.body })

describe('@/components/profile/as-notification-prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mock_busy.value = false
    mock_status.value = 'off'
    mock_notifications.value = false
    mock_notifications_prompted.value = false
    mock_push_available.value = true
    mock_probe.mockResolvedValue({ push: true, phone_integrity: false })
    mock_is_valid_name_value.value = false
    current_user.value = null
  })

  it('does nothing when nobody is signed in yet', async () => {
    mount()
    await flushPromises()
    expect(mock_probe).not.toHaveBeenCalled()
  })

  it('shows the dialog once signed in, push is available, and undecided', async () => {
    const wrapper = mount()
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    await flushPromises()

    const dialog = wrapper.find('dialog#notification-prompt').element
    expect(mock_probe).toHaveBeenCalled()
    expect(mock_refresh).toHaveBeenCalled()
    expect(dialog.open).toBe(true)
    expect(mock_notifications_prompted.value).toBe(true)
    wrapper.unmount()
  })

  it('shows immediately for an already-signed-in session (existing device/install)', async () => {
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    const dialog = wrapper.find('dialog#notification-prompt').element
    expect(dialog.open).toBe(true)
    wrapper.unmount()
  })

  it('does not show when the instance has no push capability', async () => {
    mock_push_available.value = false
    mock_probe.mockResolvedValue({ push: false, phone_integrity: false })
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    expect(mock_refresh).not.toHaveBeenCalled()
    expect(wrapper.find('dialog#notification-prompt').element.open).toBe(false)
    expect(mock_notifications_prompted.value).toBe(false)
    wrapper.unmount()
  })

  it('does not show when push is already decided (on or blocked)', async () => {
    mock_status.value = 'on'
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    expect(mock_refresh).toHaveBeenCalled()
    expect(wrapper.find('dialog#notification-prompt').element.open).toBe(false)
    wrapper.unmount()
  })

  it('does not show again once already prompted on this device', async () => {
    mock_notifications_prompted.value = true
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    expect(mock_probe).not.toHaveBeenCalled()
    expect(wrapper.find('dialog#notification-prompt').element.open).toBe(false)
    wrapper.unmount()
  })

  it('enables push and closes on allow', async () => {
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('#notification-prompt-allow').trigger('click')
    await flushPromises()

    expect(mock_enable).toHaveBeenCalled()
    expect(mock_notifications.value).toBe(true)
    expect(wrapper.find('dialog#notification-prompt').element.open).toBe(false)
    wrapper.unmount()
  })

  it('leaves notifications off and closes on skip', async () => {
    current_user.value = { uid: 'test-user' }
    mock_is_valid_name_value.value = true
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('#notification-prompt-skip').trigger('click')
    await flushPromises()

    expect(mock_enable).not.toHaveBeenCalled()
    expect(mock_notifications.value).toBe(false)
    expect(wrapper.find('dialog#notification-prompt').element.open).toBe(false)
    wrapper.unmount()
  })

  it('states the broadcast cadence', () => {
    const wrapper = mount()
    expect(wrapper.find('#notification-prompt-cadence').text()).toMatch(
      /thursdays/i
    )
    wrapper.unmount()
  })
})
