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
    const setup_key_listeners = () => {
      watch(
        key_commands.get_available_commands,
        available_commands => {
          console.log('Available commands:', available_commands)
          available_commands.forEach(cmd => {
            const key_combo = cmd.key
            if (magic_keys[key_combo])
              watch(magic_keys[key_combo], is_pressed => {
                if (is_pressed) {
                  console.log(`Key pressed: ${key_combo} -> ${cmd.command}`)
                  key_commands.execute_command(cmd.command, cmd.parameters)
                }
              })
          })
        },
        { immediate: true }
      )
    }

    setup_key_listeners()
  }
}
