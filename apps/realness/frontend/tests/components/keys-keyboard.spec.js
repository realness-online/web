import {
  afterEach as after_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import {
  enableAutoUnmount as enable_auto_unmount,
  mount
} from '@vue/test-utils'
import KeysKeyboard from '@/components/keys-keyboard.vue'
import { KEY_LAYERS, key_overview } from '@/utils/keys-overview'

enable_auto_unmount(after_each)

const open = () => mount(KeysKeyboard, { props: { groups: key_overview() } })
const shown = keyboard =>
  keyboard.get('[role="group"]').attributes('aria-label')

describe('keys-keyboard', () => {
  it('offers one button per modifier layer and starts with no modifier', () => {
    const keyboard = open()
    const buttons = keyboard.findAll('nav[aria-label="Modifier layer"] button')
    expect(buttons).toHaveLength(KEY_LAYERS.length)
    expect(shown(keyboard)).toBe('No modifier layer')
  })

  it('shows a layer when its button is pressed', async () => {
    const keyboard = open()
    const buttons = keyboard.findAll('nav[aria-label="Modifier layer"] button')
    await buttons[KEY_LAYERS.indexOf('shift')].trigger('click')
    expect(shown(keyboard)).toBe('Shift layer')
  })

  it('follows a held modifier and lets go on release', async () => {
    const keyboard = open()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Meta', metaKey: true })
    )
    await keyboard.vm.$nextTick()
    expect(shown(keyboard)).toBe('Cmd / Ctrl layer')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }))
    await keyboard.vm.$nextTick()
    expect(shown(keyboard)).toBe('No modifier layer')
  })

  it('ignores a plain key while no modifier is held', async () => {
    const keyboard = open()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await keyboard.vm.$nextTick()
    expect(shown(keyboard)).toBe('No modifier layer')
  })

  it('stops listening once unmounted', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    open().unmount()
    expect(removed.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['keydown', 'keyup', 'blur'])
    )
    removed.mockRestore()
  })
})
