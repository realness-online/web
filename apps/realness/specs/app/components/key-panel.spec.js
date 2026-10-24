import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AsKeyPanel from '@/components/key-panel.vue'
import { bold, boulders, medium } from '@/utils/preference'

const commands = [
  { key: 'z', command: 'pref::Toggle_Bold', leader: true },
  { key: 'Z', command: 'pref::Toggle_Boulders', leader: true },
  { key: 'x', command: 'pref::Toggle_Medium', leader: true },
  { key: '`', command: 'view::Toggle_Chat', leader: true },
  { key: '4', command: 'view::Layout_Chat_Tui', leader: true },
  { key: '6', command: 'nav::Go_Account', leader: true },
  { key: '?', command: 'ui::Show_Documentation', leader: true },
  { key: 'ArrowUp', command: 'pref::Camera_Up', leader: false }
]

const open_panel = (open = true) => {
  const key_commands = {
    panel_open: ref(open),
    get_available_commands: ref(commands),
    run_command: vi.fn()
  }
  const wrapper = mount(AsKeyPanel, {
    global: { provide: { 'key-commands': key_commands } }
  })
  return { wrapper, key_commands }
}

afterEach(() => {
  bold.value = true
  medium.value = true
  boulders.value = true
})

describe('key panel', () => {
  it('draws only while open', () => {
    const { wrapper } = open_panel(false)
    expect(wrapper.find('dialog').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows each leader key on its row with its Shift command', () => {
    const { wrapper } = open_panel()
    const z = wrapper.get('button[value="z"]')
    expect(z.get('span').text()).toBe('Bold')
    expect(z.get('small').text()).toBe('Boulders')
    expect(wrapper.get('button[value="/"] small').text()).toBe('Docs')
    expect(wrapper.get('button[value="`"] span').text()).toBe('Chat')
    expect(wrapper.get('button[value="4"] span').text()).toBe('Chat + terminal')
    expect(wrapper.get('button[value="6"] span').text()).toBe('Account')
    expect(wrapper.find('button[value="ArrowUp"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('fills the keys whose settings are on', () => {
    bold.value = true
    medium.value = false
    const { wrapper } = open_panel()
    expect(wrapper.get('button[value="z"]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(wrapper.get('button[value="x"]').attributes('aria-pressed')).toBe(
      'false'
    )
    expect(
      wrapper.get('button[value="6"]').attributes('aria-pressed')
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('holding Shift marks the panel so Shift commands brighten', async () => {
    const { wrapper } = open_panel()
    const panel = () => wrapper.get('dialog').attributes('data-shift')
    expect(panel()).toBeUndefined()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })
    )
    await wrapper.vm.$nextTick()
    expect(panel()).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    await wrapper.vm.$nextTick()
    expect(panel()).toBeUndefined()
    wrapper.unmount()
  })

  it('holding Shift fills keys by their Shift setting', async () => {
    bold.value = true
    boulders.value = false
    const { wrapper } = open_panel()
    const z = () => wrapper.get('button[value="z"]').attributes('aria-pressed')
    expect(z()).toBe('true')
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })
    )
    await wrapper.vm.$nextTick()
    expect(z()).toBe('false')
    expect(wrapper.get('button[value="x"]').attributes('aria-pressed')).toBe(
      'true'
    )
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    await wrapper.vm.$nextTick()
    expect(z()).toBe('true')
    wrapper.unmount()
  })

  it('a click runs the key and closes the panel', async () => {
    const { wrapper, key_commands } = open_panel()
    await wrapper.get('button[value="z"]').trigger('click')
    expect(key_commands.run_command).toHaveBeenCalledWith('pref::Toggle_Bold')
    expect(key_commands.panel_open.value).toBe(false)
    wrapper.unmount()
  })
})
