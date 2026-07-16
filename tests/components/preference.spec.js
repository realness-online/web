import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Preference from '@/components/preference.vue'
import * as preferences from '@/utils/preference'

vi.mock('@/utils/keymaps', () => ({
  get_preference_hint: name => (name === 'mosaic' ? 'Tiles hint' : null),
  get_preference_keys: name => (name === 'mosaic' ? ['m'] : []),
  get_preference_cycle_keys: name => (name === 'animate' ? ['shift+a'] : []),
  get_preference_cycle_hint: name =>
    name === 'animate' ? 'cycle speeds' : null,
  get_preference_icon: name => (name === 'animate' ? 'play' : null)
}))

const mount = (props = {}) =>
  shallowMount(Preference, {
    props: { name: 'mosaic', ...props },
    global: { stubs: { icon: true } }
  })

describe('@/components/preference', () => {
  beforeEach(() => {
    preferences.mosaic.value = false
    preferences.shadow.value = false
    preferences.drama.value = false
    preferences.drama_back.value = false
    preferences.drama_front.value = false
    preferences.animate.value = false
    vi.restoreAllMocks()
  })

  it('renders the preference name and toggle', () => {
    const wrapper = mount()
    expect(wrapper.find('fieldset[data-preference]').exists()).toBe(true)
    expect(wrapper.find('h4').text()).toContain('mosaic')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows keymap hint text by default', () => {
    const wrapper = mount()
    expect(wrapper.find('p[data-hint]').text()).toContain('Tiles hint')
    expect(wrapper.find('kbd').text()).toBe('m')
  })

  it('uses title instead of hint when provided', () => {
    const wrapper = mount({ title: 'Custom title' })
    expect(wrapper.find('p').text()).toBe('Custom title')
    expect(wrapper.find('p[data-hint]').exists()).toBe(false)
  })

  it('shows on/off state text when asked', async () => {
    preferences.mosaic.value = true
    const wrapper = mount({ show_state: true })
    expect(wrapper.find('h4').text()).toContain('(on)')
  })

  it('applies mosaic and enables geology layers', async () => {
    const enable = vi.spyOn(preferences, 'enable_geology_layers')
    const wrapper = mount({ name: 'mosaic' })
    await wrapper.find('input').setValue(true)
    expect(preferences.mosaic.value).toBe(true)
    expect(enable).toHaveBeenCalled()
  })

  it('applies shadow and enables shadow layers', async () => {
    const enable = vi.spyOn(preferences, 'enable_shadow_layers')
    const wrapper = mount({ name: 'shadow' })
    await wrapper.find('input').setValue(true)
    expect(preferences.shadow.value).toBe(true)
    expect(enable).toHaveBeenCalled()
  })

  it('mirrors drama to front and back prefs', async () => {
    const wrapper = mount({ name: 'drama' })
    await wrapper.find('input').setValue(true)
    expect(preferences.drama.value).toBe(true)
    expect(preferences.drama_back.value).toBe(true)
    expect(preferences.drama_front.value).toBe(true)
  })

  it('renders an icon and cycle hint when requested', () => {
    const wrapper = mount({ name: 'animate', icon: true })
    expect(wrapper.findComponent({ name: 'icon' }).exists()).toBe(true)
    expect(wrapper.findAll('p[data-hint]').at(-1).text()).toContain(
      'cycle speeds'
    )
  })

  it('hides hints in compact mode', () => {
    const wrapper = mount({ compact: true })
    expect(wrapper.find('fieldset[data-preference]').classes()).toContain(
      'compact'
    )
    expect(wrapper.find('p[data-hint]').exists()).toBe(false)
  })
})
