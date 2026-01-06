import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref, watch } from 'vue'
import { key_commands_plugin } from '@/plugins/key-commands'
import { use_key_commands } from '@/use/key-commands'

vi.mock('@/use/key-commands', () => ({
  use_key_commands: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useMagicKeys: vi.fn(() => ({}))
}))

vi.mock('@/utils/keymaps', () => ({
  default_keymap: [
    {
      context: 'Global',
      bindings: {
        'cmd+s': 'file::save',
        escape: 'modal::close',
        a: 'action::test',
        A: 'action::test_upper',
        1: 'nav::go_home',
        '#1': 'nav::numpad_home',
        '!': 'action::exclamation'
      }
    }
  ],
  normalize_key_for_platform: vi.fn(key => key)
}))

describe('key-commands plugin', () => {
  let mock_app
  let mock_key_commands
  let mock_magic_keys
  let addEventListener_spy
  let removeEventListener_spy
  let console_warn_spy

  beforeEach(() => {
    vi.clearAllMocks()

    mock_key_commands = {
      load_keymap: vi.fn(),
      update_input_focus: vi.fn(),
      check_input_focus: vi.fn(() => false),
      get_available_commands: ref([
        {
          key: 'cmd+s',
          command: 'file::save',
          parameters: {},
          context: 'Global'
        },
        {
          key: 'Escape',
          command: 'modal::close',
          parameters: {},
          context: 'Global'
        },
        {
          key: 'a',
          command: 'action::test',
          parameters: {},
          context: 'Global'
        },
        {
          key: 'A',
          command: 'action::test_upper',
          parameters: {},
          context: 'Global'
        },
        {
          key: '!',
          command: 'action::exclamation',
          parameters: {},
          context: 'Global'
        },
        {
          key: '1',
          command: 'nav::go_home',
          parameters: {},
          context: 'Global'
        },
        {
          key: '#1',
          command: 'nav::numpad_home',
          parameters: {},
          context: 'Global'
        }
      ]),
      execute_command: vi.fn()
    }

    mock_magic_keys = {
      'cmd+s': ref(false),
      'ctrl-s': ref(false)
    }

    use_key_commands.mockReturnValue(mock_key_commands)

    mock_app = {
      provide: vi.fn()
    }

    addEventListener_spy = vi.spyOn(document, 'addEventListener')
    removeEventListener_spy = vi.spyOn(document, 'removeEventListener')
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('plugin installation', () => {
    it('installs plugin and provides key-commands', () => {
      key_commands_plugin.install(mock_app)

      expect(use_key_commands).toHaveBeenCalled()
      expect(mock_app.provide).toHaveBeenCalledWith(
        'key-commands',
        mock_key_commands
      )
    })

    it('loads keymap on install', () => {
      key_commands_plugin.install(mock_app)

      expect(mock_key_commands.load_keymap).toHaveBeenCalled()
    })

    it('sets up focus event listeners', () => {
      key_commands_plugin.install(mock_app)

      expect(addEventListener_spy).toHaveBeenCalledWith(
        'focusin',
        expect.any(Function),
        true
      )
      expect(addEventListener_spy).toHaveBeenCalledWith(
        'focusout',
        expect.any(Function),
        true
      )
    })

    it('sets up keydown event listener on window', () => {
      const window_addEventListener_spy = vi.spyOn(window, 'addEventListener')
      key_commands_plugin.install(mock_app)

      expect(window_addEventListener_spy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      )
    })
  })

  describe('focus tracking', () => {
    it('updates input focus on focusin', () => {
      key_commands_plugin.install(mock_app)

      const focusin_handler = addEventListener_spy.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1]

      if (focusin_handler) {
        focusin_handler()
        expect(mock_key_commands.update_input_focus).toHaveBeenCalled()
      }
    })

    it('updates input focus on focusout', () => {
      key_commands_plugin.install(mock_app)

      const focusout_handler = addEventListener_spy.mock.calls.find(
        call => call[0] === 'focusout'
      )?.[1]

      if (focusout_handler) {
        focusout_handler()
        expect(mock_key_commands.update_input_focus).toHaveBeenCalled()
      }
    })
  })

  describe('key translation', () => {
    let keydown_handler
    let window_addEventListener_spy

    beforeEach(() => {
      window_addEventListener_spy = vi.spyOn(window, 'addEventListener')
      key_commands_plugin.install(mock_app)
      keydown_handler = window_addEventListener_spy.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1]
    })

    it('translates number keys to Digit format', () => {
      const event = {
        code: 'Digit1',
        key: '1',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'nav::go_home',
        {}
      )
    })

    it('translates numpad keys to Numpad format', () => {
      const event = {
        code: 'Numpad1',
        key: '1',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'nav::numpad_home',
        {}
      )
    })

    it('translates letter keys to Key format', () => {
      const event = {
        code: 'KeyA',
        key: 'a',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'action::test',
        {}
      )
    })

    it('handles uppercase letters with shift', () => {
      const event = {
        code: 'KeyA',
        key: 'A',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'action::test_upper',
        {}
      )
    })

    it('translates punctuation keys', () => {
      const event = {
        code: 'Digit1',
        key: '!',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'action::exclamation',
        {}
      )
    })

    it('matches shifted symbols by event.key', () => {
      const event = {
        code: 'Digit1',
        key: '!',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).toHaveBeenCalled()
    })
  })

  describe('keydown handling', () => {
    let keydown_handler
    let window_addEventListener_spy

    beforeEach(() => {
      window_addEventListener_spy = vi.spyOn(window, 'addEventListener')
      key_commands_plugin.install(mock_app)
      keydown_handler = window_addEventListener_spy.mock.calls.find(
        call => call[0] === 'keydown'
      )?.[1]
    })

    it('prevents default and executes command on match', () => {
      const prevent_default_spy = vi.fn()
      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: prevent_default_spy
      }

      if (keydown_handler) keydown_handler(event)

      expect(prevent_default_spy).toHaveBeenCalled()
      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'modal::close',
        {}
      )
    })

    it('blocks commands when input is focused', () => {
      mock_key_commands.check_input_focus.mockReturnValue(true)

      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).not.toHaveBeenCalled()
    })

    it('blocks commands when modifier keys are pressed', () => {
      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).not.toHaveBeenCalled()
    })

    it('blocks commands when alt key is pressed', () => {
      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: false,
        altKey: true,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).not.toHaveBeenCalled()
    })

    it('blocks commands when meta key is pressed', () => {
      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: true,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.execute_command).not.toHaveBeenCalled()
    })

    it('updates input focus state on keydown', () => {
      const event = {
        code: 'Escape',
        key: 'Escape',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: vi.fn()
      }

      if (keydown_handler) keydown_handler(event)

      expect(mock_key_commands.check_input_focus).toHaveBeenCalled()
      expect(mock_key_commands.update_input_focus).toHaveBeenCalled()
    })
  })

  describe('combo key handling', () => {
    it('watches magic_keys for combo keys', async () => {
      const { useMagicKeys } = await import('@vueuse/core')

      mock_key_commands.get_available_commands.value = [
        {
          key: 'ctrl-s',
          command: 'file::save',
          parameters: {},
          context: 'Global'
        }
      ]

      const ctrl_s_ref = ref(false)
      mock_magic_keys['ctrl-s'] = ctrl_s_ref
      useMagicKeys.mockReturnValue(mock_magic_keys)

      key_commands_plugin.install(mock_app)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(useMagicKeys).toHaveBeenCalled()
    })

    it('executes command when combo key is pressed', async () => {
      const { useMagicKeys } = await import('@vueuse/core')

      mock_key_commands.get_available_commands.value = [
        {
          key: 'ctrl-s',
          command: 'file::save',
          parameters: {},
          context: 'Global'
        }
      ]

      const ctrl_s_ref = ref(false)
      mock_magic_keys['ctrl-s'] = ctrl_s_ref
      useMagicKeys.mockReturnValue(mock_magic_keys)

      key_commands_plugin.install(mock_app)

      await new Promise(resolve => setTimeout(resolve, 10))

      ctrl_s_ref.value = true
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mock_key_commands.execute_command).toHaveBeenCalledWith(
        'file::save',
        {}
      )
    })

    it('only watches combo keys (keys with dashes)', async () => {
      const { useMagicKeys } = await import('@vueuse/core')

      mock_key_commands.get_available_commands.value = [
        {
          key: 'a',
          command: 'action::test',
          parameters: {},
          context: 'Global'
        },
        {
          key: 'ctrl-s',
          command: 'file::save',
          parameters: {},
          context: 'Global'
        }
      ]

      const ctrl_s_ref = ref(false)
      mock_magic_keys['ctrl-s'] = ctrl_s_ref
      useMagicKeys.mockReturnValue(mock_magic_keys)

      key_commands_plugin.install(mock_app)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mock_magic_keys['ctrl-s']).toBeDefined()
    })
  })
})
