import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import PreferencesMenu from '@/components/preferences-menu.vue'
import * as preferences from '@/utils/preference'

const { mock_pane } = vi.hoisted(() => {
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
  return { mock_pane }
})

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
        }
      }
    }
  })

describe('@/components/preferences-menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('mounts the tweakpane when 3d is on', async () => {
    preferences.view_3d.value = true
    const wrapper = mount()
    await flushPromises()
    expect(mock_pane.addFolder).toHaveBeenCalled()
    expect(wrapper.find('.tweakpane__host').exists()).toBe(true)
    wrapper.unmount()
  })
})
