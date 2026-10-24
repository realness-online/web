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

describe('@/components/preferences-menu pane lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preferences.view_3d.value = false
  })

  afterEach(() => {
    preferences.view_3d.value = false
  })

  it('leaves the pane alone while 3D is on', async () => {
    preferences.view_3d.value = true
    const wrapper = mount()
    await flushPromises()
    mock_pane.dispose.mockClear()

    wrapper.vm.on_slide_transition_end({ propertyName: 'grid-template-rows' })

    expect(mock_pane.dispose).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a transition that is not the slide', async () => {
    preferences.view_3d.value = true
    const wrapper = mount()
    await flushPromises()
    mock_pane.dispose.mockClear()

    wrapper.vm.on_slide_transition_end({ propertyName: 'opacity' })

    expect(mock_pane.dispose).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('disposes the pane when the slide closes', async () => {
    vi.stubGlobal('matchMedia', query => ({
      matches: String(query).includes('reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
    preferences.view_3d.value = true
    const wrapper = mount()
    await flushPromises()

    preferences.view_3d.value = false
    await flushPromises()
    wrapper.vm.on_slide_transition_end({ propertyName: 'grid-template-rows' })

    expect(mock_pane.dispose).toHaveBeenCalled()
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('does not mount a pane while 3D is off', async () => {
    preferences.view_3d.value = false
    const wrapper = mount()
    await flushPromises()

    const { Pane } = await import('tweakpane')
    expect(Pane).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
