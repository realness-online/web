import { use_key_commands } from '@/use/key-commands'
import { useMagicKeys as use_magic_keys } from '@vueuse/core'
import { watch, inject } from 'vue'
import { parse_key_combination } from '@/utils/keymaps'

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

    const setup_key_listeners = () => {
      let unwatch_functions = []
      watch(
        key_commands.get_available_commands,
        available_commands => {
          unwatch_functions.forEach(unwatch => unwatch())
          unwatch_functions = []

          available_commands.forEach(cmd => {
            const key_combo = cmd.key
            if (magic_keys[key_combo]) {
              const unwatch = watch(magic_keys[key_combo], is_pressed => {
                if (is_pressed) {
                  // Check if any modifier keys are pressed
                  const has_modifier =
                    magic_keys.ctrl?.value ||
                    magic_keys.shift?.value ||
                    magic_keys.alt?.value ||
                    magic_keys.meta?.value

                  if (has_modifier && !key_combo.includes('-')) return

                  key_commands.execute_command(cmd.command, cmd.parameters)
                }
              })
              unwatch_functions.push(unwatch)
            }
          })
        },
        { immediate: true }
      )
    }

    setup_key_listeners()
  }
}
