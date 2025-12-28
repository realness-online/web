import { use_key_commands } from '@/use/key-commands'
import { useMagicKeys as use_magic_keys } from '@vueuse/core'
import { watch } from 'vue'

export const key_commands_plugin = {
  install(app) {
    const key_commands = use_key_commands()
    const magic_keys = use_magic_keys()
    app.provide('key-commands', key_commands)
    key_commands.load_keymap()

    // Add focus tracking
    const handle_focus_change = () => {
      key_commands.update_input_focus()
    }

    document.addEventListener('focusin', handle_focus_change, true)
    document.addEventListener('focusout', handle_focus_change, true)

    // Translate simple keymap keys to event.code
    const translate_key = key => {
      // Numbers '0'-'9' -> 'Digit0'-'Digit9'
      if (key >= '0' && key <= '9') return `Digit${key}`
      // Numpad '#0'-'#9' -> 'Numpad0'-'Numpad9'
      if (
        key.startsWith('#') &&
        key.length === 2 &&
        key[1] >= '0' &&
        key[1] <= '9'
      )
        return `Numpad${key[1]}`

      // Letters 'a'-'z' or 'A'-'Z' -> 'KeyA'-'KeyZ'
      if (key.length === 1 && /[a-zA-Z]/.test(key))
        return `Key${key.toUpperCase()}`

      // Punctuation and symbols mapping
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
      // Keep everything else as-is
      return key
    }

    // Handle single keys with native keyboard events
    // This gives us proper case sensitivity and physical key location
    const handle_keydown = event => {
      // Check input focus synchronously and update reactive state
      const is_input = key_commands.check_input_focus()
      key_commands.update_input_focus()
      if (is_input) return

      const available = key_commands.get_available_commands.value

      // Check event.code against translated keymap keys
      const command = available.find(cmd => {
        // For shifted symbols (? ! @ # $ % etc), match event.key directly
        const shifted_symbols = '!@#$%^&*()_+{}|:"<>?~'
        if (shifted_symbols.includes(cmd.key)) return cmd.key === event.key

        const translated = translate_key(cmd.key)

        // For letters, also check shift state
        if (translated.startsWith('Key') && /[a-zA-Z]/.test(cmd.key)) {
          const is_uppercase = cmd.key === cmd.key.toUpperCase()
          const shift_pressed = event.shiftKey

          // Must match both the physical key AND shift state
          return translated === event.code && is_uppercase === shift_pressed
        }

        // For non-letters, just match the code
        return translated === event.code
      })

      if (command) {
        // Block if modifier keys are pressed (ctrl/alt/meta block everything)
        if (event.ctrlKey || event.altKey || event.metaKey) return

        event.preventDefault()
        key_commands.execute_command(command.command, command.parameters)
      }
    }

    // Handle combo keys (ctrl-s, ctrl-d, etc) with magic_keys
    let unwatch_functions = []
    watch(
      key_commands.get_available_commands,
      available_commands => {
        unwatch_functions.forEach(unwatch => unwatch())
        unwatch_functions = []

        available_commands
          .filter(cmd => cmd.key.includes('-')) // Only combo keys
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

    // Use window with capture phase to intercept events even from modal dialogs
    window.addEventListener('keydown', handle_keydown, true)
  }
}
