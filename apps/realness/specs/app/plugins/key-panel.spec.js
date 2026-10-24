import { beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { key_commands_plugin } from '@/plugins/key-commands'
import { default_keymap } from '@/utils/keymaps'

vi.mock('@vueuse/core', () => ({ useMagicKeys: vi.fn(() => ({})) }))

/** One install for the file: the plugin listens on window for good. */
let key_commands
const ran = []

const press = (code, key, modifiers = {}) => {
  const event = new KeyboardEvent('keydown', {
    code,
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers
  })
  ;(document.activeElement ?? window).dispatchEvent(event)
  return event
}
const leader = () => press('Space', ' ', { altKey: true })

beforeAll(() => {
  localStorage.setItem(
    'realness_keymap',
    JSON.stringify([
      {
        leader: true,
        bindings: {
          z: 'pref::Toggle_Bold',
          Z: 'pref::Toggle_Boulders',
          '`': 'view::Toggle_Chat',
          6: 'nav::Go_Account'
        }
      }
    ])
  )
  key_commands_plugin.install({
    provide: (name, value) => (key_commands = value)
  })
  for (const command of [
    'pref::Toggle_Bold',
    'pref::Toggle_Boulders',
    'view::Toggle_Chat',
    'nav::Go_Account'
  ])
    key_commands.register_handler(command, {
      handler: () => ran.push(command),
      context: 'global'
    })
})

beforeEach(() => {
  ran.length = 0
  key_commands.panel_open.value = false
  document.activeElement?.blur?.()
  document.body.innerHTML = ''
})

describe('Option+Space key panel', () => {
  it('ships every app setting behind the leader', () => {
    expect(default_keymap.find(context => !context.context).leader).toBe(true)
  })

  it('bare keys no longer change settings', () => {
    const event = press('KeyZ', 'z')
    expect(ran).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('opens on Option+Space and runs one key, even while typing', () => {
    const input = document.createElement('textarea')
    document.body.append(input)
    input.focus()
    expect(leader().defaultPrevented).toBe(true)
    expect(key_commands.panel_open.value).toBe(true)
    const event = press('KeyZ', 'z')
    expect(event.defaultPrevented).toBe(true)
    expect(ran).toEqual(['pref::Toggle_Bold'])
    expect(key_commands.panel_open.value).toBe(false)
    press('KeyZ', 'z')
    expect(ran).toEqual(['pref::Toggle_Bold'])
  })

  it('Shift waits for its letter; Escape and unbound keys only close', () => {
    leader()
    press('ShiftLeft', 'Shift', { shiftKey: true })
    expect(key_commands.panel_open.value).toBe(true)
    press('KeyZ', 'Z', { shiftKey: true })
    expect(ran).toEqual(['pref::Toggle_Boulders'])
    leader()
    expect(press('Escape', 'Escape').defaultPrevented).toBe(true)
    expect(key_commands.panel_open.value).toBe(false)
    leader()
    expect(press('KeyQ', 'q').defaultPrevented).toBe(true)
    expect(key_commands.panel_open.value).toBe(false)
    expect(ran).toEqual(['pref::Toggle_Boulders'])
  })

  it('Option on the number row runs the same view as the panel', () => {
    expect(press('Backquote', '`', { altKey: true }).defaultPrevented).toBe(
      true
    )
    expect(press('Digit6', '§', { altKey: true }).defaultPrevented).toBe(true)
    leader()
    press('Digit6', '§', { altKey: true })
    expect(ran).toEqual([
      'view::Toggle_Chat',
      'nav::Go_Account',
      'nav::Go_Account'
    ])
    expect(key_commands.panel_open.value).toBe(false)
    expect(press('Digit0', 'º', { altKey: true }).defaultPrevented).toBe(false)
    key_commands.unregister_handler('view::Toggle_Chat')
    expect(press('Backquote', '`', { altKey: true }).defaultPrevented).toBe(
      false
    )
  })

  it('works with Option still held, and a second Option+Space closes', () => {
    leader()
    press('KeyZ', 'Ω', { altKey: true })
    expect(ran).toEqual(['pref::Toggle_Bold'])
    leader()
    leader()
    expect(key_commands.panel_open.value).toBe(false)
  })

  it('Shift+Option+Space stays open across keys until Escape', () => {
    press('Space', ' ', { altKey: true, shiftKey: true })
    press('KeyZ', 'z')
    press('Digit6', '6')
    press('KeyQ', 'q')
    expect(key_commands.panel_open.value).toBe(true)
    expect(ran).toEqual(['pref::Toggle_Bold', 'nav::Go_Account'])
    press('Escape', 'Escape')
    expect(key_commands.panel_open.value).toBe(false)
    leader()
    press('KeyZ', 'z')
    expect(key_commands.panel_open.value).toBe(false)
  })

  it('Option+Space closes a sticky panel', () => {
    press('Space', ' ', { altKey: true, shiftKey: true })
    leader()
    expect(key_commands.panel_open.value).toBe(false)
  })
})
