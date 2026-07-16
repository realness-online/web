import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import PreferencesMenu from '@/components/preferences-menu.vue'
import * as preferences from '@/utils/preference'

const {
  mock_ready,
  mock_push_available,
  mock_push_status,
  mock_sync_folder,
  mock_sync_folder_name,
  mock_sync_folder_supported,
  mock_pane
} = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  const mock_pane = {
    dispose: vi.fn(),
    addFolder: vi.fn(function () {
      return this
    }),
    addBinding: vi.fn(function () {
      return { on: vi.fn().mockReturnThis() }
    })
  }
  mock_pane.addFolder.mockImplementation(function () {
    return this
  })
  return {
    mock_ready: create_ref(true),
    mock_push_available: create_ref(true),
    mock_push_status: create_ref('off'),
    mock_sync_folder: vi.fn(),
    mock_sync_folder_name: create_ref('Downloads'),
    mock_sync_folder_supported: vi.fn(() => false),
    mock_pane
  }
})

vi.mock('@/use/instance-capabilities', () => ({
  use_instance_capabilities: () => ({
    ready: mock_ready,
    push: mock_push_available,
    probe: vi.fn()
  })
}))

vi.mock('@/use/push', () => ({
  use_push: () => ({
    status: mock_push_status,
    busy: { value: false, __v_isRef: true },
    supported: true,
    refresh: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn()
  })
}))

vi.mock('@/use/sync-folder', () => ({
  sync_folder_supported: () => mock_sync_folder_supported(),
  use: () => ({
    sync_folder: mock_sync_folder,
    sync_folder_name: mock_sync_folder_name
  })
}))

vi.mock('tweakpane', () => ({
  Pane: vi.fn(function Pane() {
    return mock_pane
  })
}))

const mount = (props = {}) =>
  shallowMount(PreferencesMenu, {
    props,
    global: {
      stubs: {
        preference: {
          name: 'Preference',
          props: ['name', 'label', 'title', 'icon'],
          template:
            '<fieldset class="preference-stub" :data-name="name"><slot /></fieldset>'
        },
        'as-fieldset-notifications': true
      }
    }
  })

describe('@/components/preferences-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_ready.value = true
    mock_push_available.value = true
    mock_push_status.value = 'off'
    mock_sync_folder_supported.mockReturnValue(false)
    mock_sync_folder_name.value = 'Downloads'
    preferences.view_3d.value = false
  })

  afterEach(() => {
    preferences.view_3d.value = false
  })

  it('renders mosaic, shadow, and motion sections', () => {
    const wrapper = mount()
    expect(wrapper.find('menu[data-preferences-menu]').exists()).toBe(true)
    expect(wrapper.find('#preferences-mosaic').text()).toBe('Mosaic')
    expect(wrapper.find('#preferences-shadow').text()).toBe('Shadow')
    expect(wrapper.find('#preferences-motion').text()).toBe('Motion')
    expect(
      wrapper.findAllComponents({ name: 'Preference' }).length
    ).toBeGreaterThan(10)
  })

  it('shows account services when push is available', () => {
    const wrapper = mount()
    expect(wrapper.find('#preferences-account').exists()).toBe(true)
    expect(
      wrapper.findComponent({ name: 'as-fieldset-notifications' }).exists()
    ).toBe(true)
  })

  it('hides account services when push is unsupported and sync is off', () => {
    mock_push_status.value = 'unsupported'
    mock_sync_folder_supported.mockReturnValue(false)
    const wrapper = mount()
    expect(wrapper.find('#preferences-account').exists()).toBe(false)
  })

  it('shows sync folder controls when supported', () => {
    mock_sync_folder_supported.mockReturnValue(true)
    const wrapper = mount()
    expect(wrapper.text()).toContain('Downloads')
    expect(wrapper.find('button').text()).toBe('Choose folder')
  })

  it('chooses a sync folder when the button is clicked', async () => {
    mock_sync_folder_supported.mockReturnValue(true)
    const wrapper = mount()
    await wrapper.find('button').trigger('click')
    expect(mock_sync_folder).toHaveBeenCalled()
  })

  it('mounts the tweakpane when 3d is on', async () => {
    preferences.view_3d.value = true
    const wrapper = mount()
    await flushPromises()
    expect(mock_pane.addFolder).toHaveBeenCalled()
    expect(wrapper.find('.tweakpane__host').exists()).toBe(true)
    wrapper.unmount()
  })
})
