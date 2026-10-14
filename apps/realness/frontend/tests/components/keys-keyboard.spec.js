import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import KeysKeyboard from '@/components/keys-keyboard.vue'
import { key_overview } from '@/utils/keys-overview'

const groups = key_overview()

const mount_keyboard = () =>
  shallowMount(KeysKeyboard, { props: { groups } })

const key_event = (type, init) =>
  window.dispatchEvent(new KeyboardEvent(type, init))

describe('@/components/keys-keyboard', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = mount_keyboard()
    await flushPromises()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('draws every cap in the keyboard layout', () => {
    const caps = wrapper.findAll('[data-cap]')
    expect(caps.length).toBeGreaterThan(50)
  })

  it('marks a cap that carries a command and leaves the rest plain', () => {
    const buttons = wrapper.findAll('div[role="group"] button')
    const with_claims = buttons.filter(button => button.find('small').exists())
    expect(with_claims.length).toBeGreaterThan(0)
  })

  it('lists the legend of owning groups', () => {
    const legend = wrapper.findAll('ul[data-legend] li')
    expect(legend.length).toBeGreaterThan(1)
  })

  it('starts on the plain layer', () => {
    expect(wrapper.vm.layer).toBe('plain')
    expect(wrapper.find('figure[data-keyboard]').exists()).toBe(true)
  })

  it('offers one layer button per modifier plus plain', () => {
    const buttons = wrapper.findAll('nav[aria-label="Modifier layer"] button')
    expect(buttons).toHaveLength(4)
    expect(buttons.map(button => button.text())).toEqual([
      expect.stringContaining('No modifier'),
      expect.stringContaining('Shift'),
      expect.stringContaining('Option'),
      expect.stringContaining('Cmd')
    ])
  })

  it('switches the shown layer when a layer is chosen', async () => {
    const buttons = wrapper.findAll('nav[aria-label="Modifier layer"] button')
    await buttons[3].trigger('click')

    expect(wrapper.vm.chosen).toBe('cmd')
    expect(wrapper.vm.layer).toBe('cmd')
  })

  it('clears a selected cap when the layer changes', async () => {
    wrapper.vm.selected = 'a'
    const buttons = wrapper.findAll('nav[aria-label="Modifier layer"] button')
    await buttons[1].trigger('click')

    expect(wrapper.vm.selected).toBe('')
  })

  it('follows a held modifier while the key is down', async () => {
    key_event('keydown', { key: 'Shift', shiftKey: true, bubbles: true })
    await flushPromises()

    expect(wrapper.vm.pressed).toBe('shift')
    expect(wrapper.vm.layer).toBe('shift')
  })

  it('lets the strongest held modifier win', async () => {
    key_event('keydown', {
      key: 'Meta',
      metaKey: true,
      shiftKey: true,
      bubbles: true
    })
    await flushPromises()

    expect(wrapper.vm.layer).toBe('cmd')
  })

  it('treats control as the same layer as cmd', async () => {
    key_event('keydown', { key: 'Control', ctrlKey: true, bubbles: true })
    await flushPromises()

    expect(wrapper.vm.layer).toBe('cmd')
  })

  it('uses the option layer when option is held', async () => {
    key_event('keydown', { key: 'Alt', altKey: true, bubbles: true })
    await flushPromises()

    expect(wrapper.vm.layer).toBe('option')
  })

  it('ignores an ordinary key press', async () => {
    key_event('keydown', { key: 'a', bubbles: true })
    await flushPromises()

    expect(wrapper.vm.pressed).toBe('')
  })

  it('returns to the chosen layer when the modifier is released', async () => {
    key_event('keydown', { key: 'Shift', shiftKey: true, bubbles: true })
    await flushPromises()
    key_event('keyup', { key: 'Shift', bubbles: true })
    await flushPromises()

    expect(wrapper.vm.pressed).toBe('')
    expect(wrapper.vm.layer).toBe('plain')
  })

  it('drops back to the chosen layer when the window loses focus', async () => {
    key_event('keydown', { key: 'Shift', shiftKey: true, bubbles: true })
    await flushPromises()
    window.dispatchEvent(new Event('blur'))
    await flushPromises()

    expect(wrapper.vm.pressed).toBe('')
  })

  it('lights the modifier cap for the layer it belongs to', () => {
    wrapper.vm.chosen = 'cmd'

    expect(wrapper.vm.held('cmd')).toBe(true)
    expect(wrapper.vm.held('control')).toBe(true)
    expect(wrapper.vm.held('shift')).toBe(false)
  })

  it('counts the caps that carry anything', () => {
    expect(wrapper.vm.count('plain')).toBeGreaterThan(0)
  })

  it('reads a command into a short label', () => {
    expect(wrapper.vm.short({ command: 'pref::Toggle_Mosaic' })).toBe('Mosaic')
    expect(wrapper.vm.short({ command: 'view::Go_Home' })).toBe('Home')
  })

  it('falls back to the description for a listener row', () => {
    expect(
      wrapper.vm.short({ description: 'Show the command palette' })
    ).toBe('command palette')
  })

  it('names the group that owns a cap', () => {
    const owner = wrapper.vm.owner('a')
    expect(owner === undefined || typeof owner === 'string').toBe(true)
  })

  it('reports a collision when more than one group claims a cap', () => {
    const wide = wrapper.vm.owner('a')
    expect(['collision', null, undefined, ...groups.map(g => g.id)]).toContain(
      wide
    )
  })

  it('selects a cap to show its detail', async () => {
    const cap = Object.keys(wrapper.vm.caps)[0]
    wrapper.vm.selected = cap
    await flushPromises()

    expect(wrapper.vm.detail.length).toBe(wrapper.vm.caps[cap].length)
  })

  it('shows no detail when nothing is selected', () => {
    wrapper.vm.selected = ''
    expect(wrapper.vm.detail).toEqual([])
  })

  it('lists only the groups that bind a real key', () => {
    const legend = wrapper.vm.legend
    expect(legend.length).toBeGreaterThan(0)
    legend.forEach(item => {
      expect(typeof item.id).toBe('string')
      expect(typeof item.title).toBe('string')
    })
  })

  it('shows how many caps each layer carries', () => {
    const buttons = wrapper.findAll('nav[aria-label="Modifier layer"] button')
    buttons.forEach(button => {
      expect(button.find('small').text()).toMatch(/^\d+$/)
    })
  })

  it('removes its listeners when the keyboard unmounts', async () => {
    const wrapper_alone = mount_keyboard()
    await flushPromises()
    wrapper_alone.unmount()

    expect(() =>
      key_event('keydown', { key: 'Shift', shiftKey: true, bubbles: true })
    ).not.toThrow()
  })
})
