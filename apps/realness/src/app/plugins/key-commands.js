import { use_key_commands } from '@/use/key-commands'
import { useMagicKeys as use_magic_keys } from '@vueuse/core'
import { watch } from 'vue'

export const key_commands_plugin = {
  install(app) {
    const key_commands = use_key_commands()
    const magic_keys = use_magic_keys()
    app.provide('key-commands', key_commands)
    key_commands.load_keymap()

    const handle_focus_change = () => {
      key_commands.update_input_focus()
    }

    document.addEventListener('focusin', handle_focus_change, true)
    document.addEventListener('focusout', handle_focus_change, true)

    const translate_key = key => {
      if (key >= '0' && key <= '9') return `Digit${key}`
      if (
        key.startsWith('#') &&
        key.length === 2 &&
        key[1] >= '0' &&
        key[1] <= '9'
      )
        return `Numpad${key[1]}`

      if (key.length === 1 && /[a-zA-Z]/.test(key))
        return `Key${key.toUpperCase()}`

      const punctuation_map = {
        ',': 'Comma',
        '.': 'Period',
        '/': 'Slash',
        ';': 'Semicolon',
        "'": 'Quote',
        '[': 'BracketLeft',
        ']': 'BracketRight',
        '\\': 'Backslash',
        '`': 'Backquote',
        '-': 'Minus',
        '=': 'Equal'
      }
      if (punctuation_map[key]) return punctuation_map[key]
      return key
    }

    /** Physical key and Shift state, so Option characters and layouts don't matter. */
    const matches = (cmd, event) => {
      const shifted_symbols = '!@#$%^&*()_+{}|:"<>?~'
      if (shifted_symbols.includes(cmd.key)) return cmd.key === event.key

      const translated = translate_key(cmd.key)

      if (translated.startsWith('Key') && /[a-zA-Z]/.test(cmd.key)) {
        const is_uppercase = cmd.key === cmd.key.toUpperCase()
        return translated === event.code && is_uppercase === event.shiftKey
      }

      return translated === event.code
    }

    const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'Control', 'Meta'])
    const is_leader = event =>
      event.code === 'Space' && event.altKey && !event.ctrlKey && !event.metaKey

    /** Claim a key before inputs, the terminal, or other listeners see it. */
    const claim = event => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    /** Open, the panel takes exactly one key: its binding, Escape, or nothing. */
    const handle_panel_key = event => {
      if (MODIFIER_KEYS.has(event.key)) return
      claim(event)
      key_commands.panel_open.value = false
      if (event.key === 'Escape' || event.ctrlKey || event.metaKey) return
      run_leader_key(event)
    }

    /** Option on the number row runs that key's panel binding directly. */
    const is_number_row = event =>
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      /^(Digit\d|Backquote)$/.test(event.code)

    const run_leader_key = event => {
      const command = key_commands.get_available_commands.value.find(
        cmd => cmd.leader && matches(cmd, event)
      )
      return Boolean(
        command && key_commands.run_command(command.command, command.parameters)
      )
    }

    const handle_keydown = event => {
      if (is_leader(event)) {
        claim(event)
        key_commands.panel_open.value = !key_commands.panel_open.value
        return
      }
      if (key_commands.panel_open.value) return handle_panel_key(event)
      if (is_number_row(event)) {
        if (run_leader_key(event)) claim(event)
        return
      }

      const is_input = key_commands.check_input_focus()
      key_commands.update_input_focus()
      if (is_input) return

      const command = key_commands.get_available_commands.value.find(
        cmd => !cmd.leader && matches(cmd, event)
      )

      if (command) {
        if (event.ctrlKey || event.altKey || event.metaKey) return

        event.preventDefault()
        key_commands.execute_command(command.command, command.parameters)
      }
    }

    let unwatch_functions = []
    watch(
      key_commands.get_available_commands,
      available_commands => {
        unwatch_functions.forEach(unwatch => unwatch())
        unwatch_functions = []

        available_commands
          .filter(cmd => cmd.key.includes('-'))
          .forEach(cmd => {
            const normalized = cmd.key.toLowerCase()
            if (magic_keys[normalized]) {
              const unwatch = watch(magic_keys[normalized], is_pressed => {
                if (is_pressed)
                  key_commands.execute_command(cmd.command, cmd.parameters)
              })
              unwatch_functions.push(unwatch)
            }
          })
      },
      { immediate: true }
    )

    window.addEventListener('keydown', handle_keydown, true)
  }
}
