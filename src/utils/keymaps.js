/**
 * @typedef {import('../types.js').Key_Binding} Key_Binding
 * @typedef {import('../types.js').Keymap_Context} Keymap_Context
 */

/**
 * @type {Keymap_Context[]}
 */
export const default_keymap = [
  {
    use_key_equivalents: true,
    bindings: {
      f: 'ui::Toggle_Fullscreen',
      'ctrl-,': 'ui::Open_Settings',
      'ctrl-k': 'ui::Show_Key_Commands',
      'ctrl-?': 'ui::Show_Documentation',
      'ctrl-/': 'ui::Show_Documentation',
      0: 'nav::Go_Home',
      1: 'nav::Go_Statements',
      2: 'nav::Go_Events',
      3: 'nav::Go_Posters',
      4: 'nav::Go_Phonebook',
      5: 'nav::Go_Thoughts'
    },
    descriptions: {
      'ui::Toggle_Fullscreen': 'Toggle fullscreen mode',
      'ui::Open_Settings': 'Open application settings',
      'ui::Show_Key_Commands': 'Show keyboard shortcuts for current view',
      'ui::Show_Documentation': 'Show application documentation',
      'nav::Go_Home': 'Go to home page',
      'nav::Go_Statements': 'Navigate to statements',
      'nav::Go_Events': 'Navigate to events',
      'nav::Go_Posters': 'Navigate to posters',
      'nav::Go_Phonebook': 'Navigate to phonebook',
      'nav::Go_Thoughts': 'Navigate to thoughts'
    }
  },
  {
    context: 'Statement',
    use_key_equivalents: true,
    bindings: {
      enter: 'statement::Save',
      'shift-enter': 'statement::NewLine',
      escape: 'statement::Cancel',
      'ctrl-s': 'statement::Save',
      'ctrl-z': 'statement::Undo',
      'ctrl-shift-z': 'statement::Redo'
    },
    descriptions: {
      'statement::Save': 'Save current statement',
      'statement::NewLine': 'Add new line',
      'statement::Cancel': 'Cancel editing',
      'statement::Undo': 'Undo statement changes',
      'statement::Redo': 'Redo statement changes'
    }
  },

  {
    context: 'Poster',
    use_key_equivalents: true,
    bindings: {
      'ctrl-0': 'poster::Reset_Zoom',
      'ctrl-=': 'poster::Zoom_In',
      'ctrl--': 'poster::Zoom_Out',
      'ctrl-s': 'poster::Save',
      'ctrl-e': 'poster::Edit',
      'ctrl-d': 'poster::Download',
      space: 'poster::Toggle_Play',
      left: 'poster::Previous',
      right: 'poster::Next'
    },
    descriptions: {
      'poster::Reset_Zoom': 'Reset zoom',
      'poster::Zoom_In': 'Zoom in',
      'poster::Zoom_Out': 'Zoom out',
      'poster::Save': 'Save poster',
      'poster::Edit': 'Edit poster',
      'poster::Download': 'Download poster',
      'poster::Toggle_Play': 'Toggle animation',
      'poster::Previous': 'Previous poster',
      'poster::Next': 'Next poster'
    }
  },
  {
    context: 'Poster_Menu',
    use_key_equivalents: true,
    bindings: {
      enter: 'poster::Open_Editor',
      delete: 'poster::Remove',
      backspace: 'poster::Remove',
      'ctrl-d': 'poster::Download'
    },
    descriptions: {
      'poster::Open_Editor': 'Open poster editor',
      'poster::Remove': 'Remove poster',
      'poster::Download': 'Download poster'
    }
  },
  {
    context: 'Poster_Editor',
    use_key_equivalents: true,
    bindings: {
      escape: 'editor::Cancel',
      'ctrl-s': 'editor::Save',
      'ctrl-enter': 'editor::Save&Close',
      'ctrl-shift-enter': 'editor::Save&New'
    },
    descriptions: {
      'editor::Cancel': 'Cancel editing',
      'editor::Save': 'Save poster',
      'editor::Save&Close': 'Save and close',
      'editor::Save&New': 'Save and create new'
    }
  },

  {
    context: 'Thoughts',
    use_key_equivalents: true,
    bindings: {
      up: 'thoughts::Previous_Item',
      down: 'thoughts::Next_Item',
      enter: 'thoughts::Open_Item'
    },
    descriptions: {
      'thoughts::Previous_Item': 'Previous item',
      'thoughts::Next_Item': 'Next item',
      'thoughts::Open_Item': 'Open selected item'
    }
  },
  {
    context: 'Events',
    use_key_equivalents: true,
    bindings: {
      'ctrl-f': 'events::Search',
      enter: 'events::Open_Event',
      delete: 'events::Remove_Event',
      escape: 'events::Clear_Search'
    },
    descriptions: {
      'events::Search': 'Search events',
      'events::Open_Event': 'Open selected event',
      'events::Remove_Event': 'Remove event',
      'events::Clear_Search': 'Clear search'
    }
  }
]

/**
 * Platform-specific key mappings for web
 */
export const platform_keymaps = {
  macos: {
    // macOS specific overrides - but we use ctrl for web compatibility
    cmd: 'ctrl',
    ctrl: 'ctrl',
    alt: 'alt',
    shift: 'shift'
  },
  windows: {
    // Windows specific overrides
    cmd: 'ctrl',
    ctrl: 'ctrl',
    alt: 'alt',
    shift: 'shift'
  },
  linux: {
    // Linux specific overrides
    cmd: 'ctrl',
    ctrl: 'ctrl',
    alt: 'alt',
    shift: 'shift'
  }
}

/**
 * Get current platform
 * @returns {string}
 */
export const get_platform = () => {
  if (navigator.platform.includes('Mac')) return 'macos'
  if (navigator.platform.includes('Win')) return 'windows'
  return 'linux'
}

/**
 * Parse key combination string
 * @param {string} key_string - Key combination like "ctrl+s" or "enter"
 * @returns {Object} Parsed key object
 */
export const parse_key_combination = key_string => {
  const parts = key_string.toLowerCase().split('-')
  const modifiers = parts.slice(0, -1)
  const key = parts[parts.length - 1]

  return {
    ctrl: modifiers.includes('ctrl'),
    cmd: modifiers.includes('cmd'),
    alt: modifiers.includes('alt'),
    shift: modifiers.includes('shift'),
    key: key
  }
}

/**
 * Convert key combination for current platform
 * @param {string} key_string - Original key combination
 * @returns {string} Platform-adjusted key combination
 */
export const normalize_key_for_platform = key_string => {
  const platform = get_platform()
  const platform_map = platform_keymaps[platform]

  let normalized = key_string
  Object.entries(platform_map).forEach(([modifier, platform_modifier]) => {
    const regex = new RegExp(`\\b${modifier}\\b`, 'g')
    normalized = normalized.replace(regex, platform_modifier)
  })

  return normalized
}

/**
 * Runtime validation for keymap configuration
 * @param {Array} keymap - Keymap configuration to validate
 * @returns {Object} Validation results
 */
export const validate_keymap_runtime = (keymap = default_keymap) => {
  const errors = []
  const warnings = []
  const used_commands = new Set()
  const used_keys = new Map()

  keymap.forEach((context, index) => {
    const context_name = context.context || 'Global'

    // Check for duplicate keys within context
    const context_keys = new Set()
    Object.entries(context.bindings || {}).forEach(([key, command]) => {
      if (context_keys.has(key)) {
        errors.push(`Duplicate key '${key}' in ${context_name} context`)
      }
      context_keys.add(key)

      // Track used commands
      const command_str = Array.isArray(command) ? command[0] : command
      used_commands.add(command_str)

      // Track key usage across contexts
      if (!used_keys.has(key)) {
        used_keys.set(key, [])
      }
      used_keys.get(key).push(context_name)
    })
  })

  // Check for conflicting keys across contexts
  used_keys.forEach((contexts, key) => {
    if (contexts.length > 1) {
      warnings.push(
        `Key '${key}' used in multiple contexts: ${contexts.join(', ')}`
      )
    }
  })

  return {
    errors,
    warnings,
    used_commands: Array.from(used_commands),
    is_valid: errors.length === 0
  }
}

/**
 * Get keymap statistics
 * @param {Array} keymap - Keymap configuration
 * @returns {Object} Statistics object
 */
export const get_keymap_stats = (keymap = default_keymap) => {
  const stats = {
    total_contexts: keymap.length,
    total_bindings: 0,
    contexts: [],
    commands: []
  }

  const commands_set = new Set()

  keymap.forEach(context_config => {
    const context = context_config.context || 'Global'
    stats.contexts.push(context)

    const binding_count = Object.keys(context_config.bindings || {}).length
    stats.total_bindings += binding_count

    Object.entries(context_config.bindings || {}).forEach(([key, command]) => {
      const command_str = Array.isArray(command) ? command[0] : command
      commands_set.add(command_str)
    })
  })

  stats.commands = Array.from(commands_set).sort()
  return stats
}

/**
 * Get command description from keymap
 * @param {string} command - Command identifier
 * @param {Array} keymap - Keymap configuration
 * @returns {string} Description or command if not found
 */
export const get_command_description = (command, keymap = default_keymap) => {
  for (const context_config of keymap) {
    const descriptions = context_config.descriptions || {}
    if (descriptions[command]) {
      return descriptions[command]
    }
  }
  return command
}

/**
 * Get all command descriptions from keymap
 * @param {Array} keymap - Keymap configuration
 * @returns {Object.<string, string>} Map of command to description
 */
export const get_all_descriptions = (keymap = default_keymap) => {
  /** @type {Object.<string, string>} */
  const all_descriptions = {}

  keymap.forEach(context_config => {
    const descriptions = context_config.descriptions || {}
    Object.assign(all_descriptions, descriptions)
  })

  return all_descriptions
}
