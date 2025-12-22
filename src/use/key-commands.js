/**
 * Centralized key command management for Realness
 * Inspired by Zed's keymap system
 */

/** @typedef {import('@/types').Available_Command} Available_Command */

import {
  ref,
  reactive,
  computed,
  watch,
  inject,
  onMounted,
  onUnmounted
} from 'vue'
import { useMagicKeys } from '@vueuse/core'
import {
  default_keymap,
  normalize_key_for_platform,
  parse_key_combination,
  validate_keymap_runtime,
  get_keymap_stats
} from '@/utils/keymaps'

/**
 * @typedef {Object} CommandHandler
 * @property {Function} handler - Function to execute
 * @property {string} context - Context where this handler is active
 * @property {Object} options - Additional options
 */

export const use_key_commands = () => {
  const active_contexts = ref(['Global'])
  const command_handlers = reactive(new Map())
  const keymap = ref([...default_keymap])
  const magic_keys = useMagicKeys()
  const is_input_focused = ref(false)

  const check_input_focus = () => {
    const active = document.activeElement
    if (!active) return false

    // If focus is on BODY or DIALOG, allow key commands
    if (active.tagName === 'BODY' || active.tagName === 'DIALOG') return false

    const input_tags = ['INPUT', 'TEXTAREA', 'SELECT']
    const is_input = input_tags.includes(active.tagName)
    const is_contenteditable = active.getAttribute('contenteditable') === 'true'

    return is_input || is_contenteditable
  }

  const update_input_focus = () => {
    is_input_focused.value = check_input_focus()
  }

  /**
   * Register a command handler
   * @param {string} command - Command identifier
   * @param {CommandHandler} handler_config
   */
  const register_handler = (
    command,
    { handler, context = 'global', options = {} }
  ) => {
    command_handlers.set(command, { handler, context, options })
  }

  /**
   * Unregister a command handler
   * @param {string} command
   */
  const unregister_handler = command => {
    command_handlers.delete(command)
  }

  /**
   * Set active contexts
   * @param {string|string[]} contexts
   */
  const set_contexts = contexts => {
    active_contexts.value = Array.isArray(contexts) ? contexts : [contexts]
  }

  /**
   * Add context to active contexts
   * @param {string} context
   */
  const add_context = context => {
    if (!active_contexts.value.includes(context))
      active_contexts.value.push(context)
  }

  /**
   * Remove context from active contexts
   * @param {string} context
   */
  const remove_context = context => {
    active_contexts.value = active_contexts.value.filter(c => c !== context)
  }

  /**
   * Execute a command
   * @param {string} command
   * @param {...any} args
   */
  const execute_command = (command, ...args) => {
    if (is_input_focused.value) return

    const handler_config = command_handlers.get(command)
    if (
      handler_config &&
      (handler_config.context === 'global' ||
        active_contexts.value.includes(handler_config.context))
    )
      handler_config.handler(...args)
  }

  /**
   * Get available commands for current contexts
   * @returns {import('vue').ComputedRef<import('@/types').Available_Command[]>}
   */
  const get_available_commands = computed(() => {
    const available = []

    keymap.value.forEach(context_config => {
      const context = context_config.context || 'global'
      if (context === 'global' || active_contexts.value.includes(context)) {
        // Use getOwnPropertyNames to preserve the order properties were defined
        const keys = Object.getOwnPropertyNames(context_config.bindings)

        keys.forEach(key => {
          const command = context_config.bindings[key]
          available.push({
            key: normalize_key_for_platform(key),
            command: typeof command === 'string' ? command : command[0],
            parameters: typeof command === 'string' ? {} : command[1] || {},
            context
          })
        })
      }
    })

    return available
  })

  /**
   * Check if a key combination is bound in current context
   * @param {string} key_combination
   * @returns {boolean}
   */
  const is_key_bound = key_combination => {
    const normalized_key = normalize_key_for_platform(key_combination)
    return get_available_commands.value.some(cmd => cmd.key === normalized_key)
  }

  /**
   * Get command for key combination
   * @param {string} key_combination
   * @returns {string|null}
   */
  const get_command_for_key = key_combination => {
    const normalized_key = normalize_key_for_platform(key_combination)
    const command = get_available_commands.value.find(
      cmd => cmd.key === normalized_key
    )
    return command ? command.command : null
  }

  /**
   * Update keymap
   * @param {Array} new_keymap
   */
  const update_keymap = new_keymap => {
    keymap.value = new_keymap
  }

  /**
   * Load keymap from storage
   */
  const load_keymap = () => {
    const stored = localStorage.getItem('realness_keymap')
    if (stored)
      try {
        keymap.value = JSON.parse(stored)
      } catch (e) {
        console.warn('Failed to load keymap from storage:', e)
      }
  }

  /**
   * Save keymap to storage
   */
  const save_keymap = () => {
    localStorage.setItem('realness_keymap', JSON.stringify(keymap.value))
  }

  /**
   * Validate current keymap
   * @returns {Object} Validation results
   */
  const validate_current_keymap = () => validate_keymap_runtime(keymap.value)

  /**
   * Get keymap statistics
   * @returns {Object} Statistics object
   */
  const get_statistics = () => get_keymap_stats(keymap.value)

  return {
    active_contexts,
    command_handlers,
    keymap,
    register_handler,
    unregister_handler,
    set_contexts,
    add_context,
    remove_context,
    execute_command,
    get_available_commands,
    is_key_bound,
    get_command_for_key,
    update_keymap,
    load_keymap,
    save_keymap,
    validate_current_keymap,
    get_statistics,
    update_input_focus,
    check_input_focus,
    is_input_focused
  }
}

/**
 * Use keymap context with automatic lifecycle management
 * @param {string} context_name - Context name
 * @returns {Object} Key commands instance with register method
 */
export function use_keymap(context_name) {
  const key_commands = inject('key-commands')

  onMounted(() => {
    key_commands.add_context(context_name)
  })

  onUnmounted(() => {
    key_commands.remove_context(context_name)
  })

  return {
    active_contexts: key_commands.active_contexts,
    command_handlers: key_commands.command_handlers,
    keymap: key_commands.keymap,

    unregister_handler: key_commands.unregister_handler,
    set_contexts: key_commands.set_contexts,
    add_context: key_commands.add_context,
    remove_context: key_commands.remove_context,
    execute_command: key_commands.execute_command,
    get_available_commands: key_commands.get_available_commands,
    is_key_bound: key_commands.is_key_bound,
    get_command_for_key: key_commands.get_command_for_key,
    update_keymap: key_commands.update_keymap,
    load_keymap: key_commands.load_keymap,
    save_keymap: key_commands.save_keymap,
    validate_current_keymap: key_commands.validate_current_keymap,
    get_statistics: key_commands.get_statistics,
    register_handler: key_commands.register_handler,
    register: (command, handler, options = {}) => {
      key_commands.register_handler(command, {
        handler,
        context: context_name,
        ...options
      })
    },
    register_preference: (command, preference) => {
      key_commands.register_handler(command, {
        handler: () => (preference.value = !preference.value),
        context: context_name
      })
    }
  }
}
