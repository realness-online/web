/**
 * @typedef {import('@/types.js').Key_Binding} Key_Binding
 * @typedef {import('@/types.js').Keymap_Context} Keymap_Context
 */

/**
 * Keymap Key Notation:
 *
 * - Letters: 'z' (lowercase), 'Z' (uppercase with shift) - case sensitive
 * - Number row: '1' '2' '3' etc - only triggers from main keyboard number row
 * - Numpad: '#1' '#2' '#3' etc - only triggers from numpad keys
 * - Special: 'Enter', 'Escape', 'Space', 'ArrowUp', etc - standard key names
 * - Combos: 'ctrl-s', 'ctrl-shift-s' - modifier combinations (lowercase, dash-separated)
 *
 * Examples:
 *   z: 'action'         -> lowercase z only
 *   Z: 'action'         -> shift+z only
 *   1: 'action'         -> number row 1 only
 *   #1: 'action'        -> numpad 1 only
 *   'ctrl-s': 'action'  -> ctrl+s combo
 *
 * @type {Keymap_Context[]}
 */
export const default_keymap = [
  {
    use_key_equivalents: true,
    bindings: {
      'Number Row': '',
      1: 'nav::Go_Thoughts',
      2: 'nav::Go_Posters',
      3: 'nav::Go_Statements',
      4: 'nav::Go_Events',
      5: 'nav::Go_Phonebook',
      6: 'nav::Go_About',
      0: 'nav::Go_Home',

      'Tab Row': '',
      i: 'pref::Toggle_Info',
      o: 'pref::Toggle_Storytelling',
      e: 'pref::Toggle_Slice',
      r: 'pref::Cycle_Aspect_Ratio',
      R: 'pref::Cycle_Aspect_Ratio',
      M: 'pref::Toggle_Menu',
      p: 'ui::Toggle_Presentation',

      'Home Row': '',
      a: 'pref::Toggle_Animate',
      s: 'pref::Toggle_Stroke',
      d: 'pref::Toggle_Drama',
      D: 'pref::Cycle_Drama',
      f: 'pref::Toggle_Shadow',
      g: 'pref::Toggle_Mosaic',

      'Shift Row': '',
      z: 'pref::Toggle_Bold',
      x: 'pref::Toggle_Medium',
      c: 'pref::Toggle_Regular',
      v: 'pref::Toggle_Light',
      b: 'pref::Toggle_Background',

      'Geology Layers (Uppercase)': '',
      Z: 'pref::Toggle_Boulders',
      X: 'pref::Toggle_Rocks',
      C: 'pref::Toggle_Gravel',
      V: 'pref::Toggle_Sand',
      B: 'pref::Toggle_Sediment',

      ',': 'ui::Open_Settings',
      '.': 'ui::Open_Account',
      '?': 'ui::Show_Documentation',
      'ctrl-shift-t': 'ui::Clear_Sync_Time'
    },
    descriptions: {
      'ui::Toggle_Presentation': 'Toggle presentation mode',
      'ui::Open_Settings': 'Show preferences',
      'ui::Open_Account': 'Open account dialog',
      'ui::Show_Documentation': 'Show application documentation',
      'ui::Clear_Sync_Time': 'Clear sync time from localStorage',
      'pref::Toggle_Shadow': 'Shadow gradient on posters',
      'pref::Toggle_Menu': 'Show poster menu on click',
      'pref::Toggle_Stroke': 'Stroke outline on posters',
      'pref::Toggle_Mosaic': 'Mosaic display on posters',
      'pref::Toggle_Background': 'Background fill on posters',
      'pref::Toggle_Drama': 'Dynamic lighting on posters',
      'pref::Cycle_Drama': 'Cycle through individual drama light settings',
      'pref::Toggle_Animate': 'Poster animation',
      'pref::Toggle_Info': 'FPS and animation info',
      'pref::Toggle_Storytelling': 'Storytelling (side-scroll) view',
      'pref::Toggle_Slice': 'Poster aspect ratio (meet/slice)',
      'pref::Cycle_Aspect_Ratio': 'Cycle through poster aspect ratio modes',
      'pref::Slice_Alignment_Up':
        'Move slice alignment up (ymid→ymax, ymin→ymid)',
      'pref::Slice_Alignment_Down':
        'Move slice alignment down (ymid→ymin, ymax→ymid)',
      'pref::Toggle_Bold': 'Bold layer visible',
      'pref::Toggle_Medium': 'Medium layer visible',
      'pref::Toggle_Regular': 'Regular layer visible',
      'pref::Toggle_Light': 'Light layer visible',
      'pref::Toggle_Boulders': 'Boulders visible',
      'pref::Toggle_Rocks': 'Rocks visible',
      'pref::Toggle_Gravel': 'Gravel visible',
      'pref::Toggle_Sand': 'Sand visible',
      'pref::Toggle_Sediment': 'Sediment visible',
      'nav::Go_Home': 'To home',
      'nav::Go_Statements': 'To thoughts',
      'nav::Go_Events': 'To events',
      'nav::Go_Posters': 'To posters',
      'nav::Go_Phonebook': 'To phonebook',
      'nav::Go_Thoughts': 'To statements',
      'nav::Go_About': 'Learn more about the app and read the documentation'
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
      delete: 'poster::Remove',
      backspace: 'poster::Remove',
      'ctrl-d': 'poster::Download'
    },
    descriptions: {
      'poster::Remove': 'Remove poster',
      'poster::Download': 'Download poster'
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
    key
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

  keymap.forEach(context => {
    const context_name = context.context || 'Global'

    // Check for duplicate keys within context
    const context_keys = new Set()
    Object.entries(context.bindings || {}).forEach(([key, command]) => {
      if (context_keys.has(key))
        errors.push(`Duplicate key '${key}' in ${context_name} context`)

      context_keys.add(key)

      // Track used commands
      const command_str = Array.isArray(command) ? command[0] : command
      used_commands.add(command_str)

      // Track key usage across contexts
      if (!used_keys.has(key)) used_keys.set(key, [])

      used_keys.get(key).push(context_name)
    })
  })

  // Check for conflicting keys across contexts
  used_keys.forEach((contexts, key) => {
    if (contexts.length > 1)
      warnings.push(
        `Key '${key}' used in multiple contexts: ${contexts.join(', ')}`
      )
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

    Object.entries(context_config.bindings || {}).forEach(([, command]) => {
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
    if (descriptions[command]) return descriptions[command]
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
export const left_pad = [
  'scrollWheel',
  'MouseUp',
  'MouseRight',
  'MouseLeft',
  'MouseDown'
]

export const function_row = [
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'PrintScreen',
  'Spotlight',
  'unknown'
]

export const digit_row = [
  'Backquote',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Minus',
  'Equal',
  'Backspace'
]

export const first_row = [
  'Tab',
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'BracketLeft',
  'BracketRight',
  'Backslash'
]

export const home_row = [
  'CapsLock',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'Quote',
  'Enter'
]

export const shift_row = [
  'ShiftLeft',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash',
  'ShiftRight'
]

export const bottom_row = [
  'ControlLeft',
  'AltLeft',
  'MetaLeft',
  'Space',
  'MetaRight',
  'AltRight',
  'Fn',
  'ControlRight'
]

export const right_pad = [
  ['Insert', 'Home', 'PageUp'],
  ['Delete', 'End', 'PageDown'],
  ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']
]

export const numpad = [
  ['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'],
  ['Numpad7', 'Numpad8', 'Numpad9'],
  ['Numpad4', 'Numpad5', 'Numpad6', 'NumpadAdd'],
  ['Numpad1', 'Numpad2', 'Numpad3'],
  ['Numpad0', 'NumpadDecimal', 'NumpadEnter']
]
