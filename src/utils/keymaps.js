/**
 * @typedef {import('@/types.js').Key_Binding} Key_Binding
 * @typedef {import('@/types.js').Keymap_Context} Keymap_Context
 */

import { shadow_value_hint } from '@/utils/shadow-values'

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
      1: 'nav::Go_Phonebook',
      2: 'nav::Go_About',
      0: 'nav::Go_Home',

      'Tab Row': '',
      i: 'pref::Toggle_Info',
      w: 'pref::Toggle_Storytelling',
      r: 'pref::Cycle_Aspect_Ratio',
      R: 'pref::Cycle_Aspect_Ratio',
      M: 'pref::Toggle_Menu',
      h: 'pref::Toggle_Footer',
      p: 'ui::Toggle_Presentation',

      'Home Row': '',
      a: 'pref::Toggle_Animate',
      A: 'pref::Cycle_Animation_Speed',
      s: 'pref::Toggle_Stroke',
      d: 'pref::Toggle_Drama',
      D: 'pref::Cycle_Drama',
      f: 'pref::Toggle_Shadow',
      g: 'pref::Toggle_Mosaic',
      q: 'pref::Toggle_View_3d',

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
      T: 'ui::Clear_Sync_Time'
    },
    descriptions: {
      'ui::Toggle_Presentation': 'Toggle presentation mode',
      'ui::Open_Settings': 'Show preferences',
      'ui::Open_Account': 'Open account',
      'ui::Show_Documentation': 'Show application documentation',
      'ui::Clear_Sync_Time': 'Clear sync time from browser storage',
      'pref::Toggle_Shadow': 'Shadow gradient on posters',
      'pref::Toggle_Menu':
        'Show bottom app bar (add, camera, settings, footer switch)',
      'pref::Toggle_Footer': 'Show/hide global footer',
      'pref::Toggle_Stroke': 'Stroke outline on posters',
      'pref::Toggle_Mosaic': 'Mosaic display on posters',
      'pref::Toggle_View_3d': '3D viewer',
      'pref::Toggle_Background': 'Background fill on posters',
      'pref::Toggle_Drama': 'Dynamic lighting on posters',
      'pref::Cycle_Drama': 'Cycle through individual drama light settings',
      'pref::Toggle_Animate': 'Poster animation',
      'pref::Cycle_Animation_Speed': 'Cycle animation speed',
      'pref::Toggle_Info': 'FPS and animation info',
      'pref::Toggle_Storytelling': 'Storytelling (side-scroll) view',
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
      'nav::Go_Phonebook': 'To phonebook',
      'nav::Go_Thoughts': 'To statements',
      'nav::Go_About': 'Learn more about the app and read the documentation'
    }
  },

  {
    context: 'Poster',
    use_key_equivalents: true,
    bindings: {
      Shortcuts: '',
      ArrowUp: 'pref::Slice_Alignment_Up',
      ArrowDown: 'pref::Slice_Alignment_Down'
    },
    descriptions: {
      'poster::Toggle_Meet_Slice': 'Toggle meet/slice on focused poster'
    }
  }
]

/**
 * Platform-specific key mappings for web
 */
const platform_keymaps = {
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
const get_platform = () => {
  if (navigator.platform.includes('Mac')) return 'macos'
  if (navigator.platform.includes('Win')) return 'windows'
  return 'linux'
}

/**
 * Convert key combination for current platform
 * @param {string} key_string - Original key combination
 * @returns {string} Platform-adjusted key combination
 */
export const normalize_key_for_platform = key_string => {
  const platform = get_platform()
  const platform_map = platform_keymaps[platform]
  if (!platform_map) return key_string

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
      if (command_str !== null && command_str !== undefined)
        used_commands.add(command_str)

      // Track key usage across contexts
      if (!used_keys.has(key)) used_keys.set(key, [])
      const key_contexts = used_keys.get(key)
      if (key_contexts) key_contexts.push(context_name)
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
  /** @type {{ total_contexts: number, total_bindings: number, contexts: string[], commands: string[] }} */
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
      if (command_str !== null && command_str !== undefined)
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

/** @type {Record<string, string>} */
export const preference_command = {
  mosaic: 'pref::Toggle_Mosaic',
  shadow: 'pref::Toggle_Shadow',
  stroke: 'pref::Toggle_Stroke',
  bold: 'pref::Toggle_Bold',
  medium: 'pref::Toggle_Medium',
  regular: 'pref::Toggle_Regular',
  light: 'pref::Toggle_Light',
  background: 'pref::Toggle_Background',
  boulders: 'pref::Toggle_Boulders',
  rocks: 'pref::Toggle_Rocks',
  gravel: 'pref::Toggle_Gravel',
  sand: 'pref::Toggle_Sand',
  sediment: 'pref::Toggle_Sediment',
  drama: 'pref::Toggle_Drama',
  animate: 'pref::Toggle_Animate',
  view_3d: 'pref::Toggle_View_3d',
  grid: 'pref::Toggle_Grid',
  info: 'pref::Toggle_Info',
  storytelling: 'pref::Toggle_Storytelling',
  only_mine: 'pref::Toggle_Only_Mine',
  menu: 'pref::Toggle_Menu',
  footer_visible: 'pref::Toggle_Footer'
}

/**
 * @param {string} command
 * @param {Keymap_Context[]} [keymap]
 * @returns {string[]}
 */
export const get_keys_for_command = (command, keymap = default_keymap) => {
  /** @type {string[]} */
  const keys = []

  for (const context_config of keymap)
    for (const [key, binding] of Object.entries(
      context_config.bindings || {}
    )) {
      if (!binding) continue
      const command_str = Array.isArray(binding) ? binding[0] : binding
      if (command_str === command) keys.push(key)
    }

  return keys
}

/**
 * @param {string} name - Preference name from `@/utils/preference`
 * @param {Keymap_Context[]} [keymap]
 * @returns {string[]}
 */
export const get_preference_keys = (name, keymap = default_keymap) => {
  const command = preference_command[name]
  if (!command) return []
  return get_keys_for_command(command, keymap)
}

/** @type {Record<string, string>} */
export const preference_cycle_command = {
  drama: 'pref::Cycle_Drama',
  animate: 'pref::Cycle_Animation_Speed'
}

/**
 * @param {string} name - Preference name from `@/utils/preference`
 * @param {Keymap_Context[]} [keymap]
 * @returns {string[]}
 */
export const get_preference_cycle_keys = (name, keymap = default_keymap) => {
  const command = preference_cycle_command[name]
  if (!command) return []
  return get_keys_for_command(command, keymap)
}

/** @type {Record<string, string>} */
export const preference_cycle_hint = {
  drama: 'cycles lights',
  animate: 'cycles speed'
}

/**
 * @param {string} name
 * @returns {string | null}
 */
export const get_preference_cycle_hint = name =>
  preference_cycle_hint[name] ?? null

/** @type {Record<string, string>} */
export const preference_hint = {
  mosaic: 'Tiles defining shape over shadow',
  shadow: 'Value layers, Light -> Bold',
  stroke: 'Outline shadow',
  bold: shadow_value_hint.bold,
  medium: shadow_value_hint.medium,
  regular: shadow_value_hint.regular,
  light: shadow_value_hint.light,
  background: shadow_value_hint.background,
  boulders: 'Largest pieces',
  rocks: 'Large pieces',
  gravel: 'Medium pieces',
  sand: 'Small pieces',
  sediment: 'Finest pieces',
  drama: 'Dynamic lighting',
  animate: 'Active backgrounds & 3d motion',
  view_3d: 'View poster in 3D',
  grid: 'Composition grid',
  info: 'FPS overlay',
  storytelling: 'View each poster in a fullscreen side scroll',
  only_mine: 'Unshortened view of your posters and statements',
  menu: 'Show app island',
  footer_visible: 'Page footer'
}

/**
 * @param {string} name
 * @returns {string | null}
 */
export const get_preference_hint = name => preference_hint[name] ?? null

/** @type {Record<string, string>} */
export const preference_icon = {
  mosaic: 'realness',
  stroke: 'circle',
  background: 'background',
  animate: 'animation',
  view_3d: 'galaxy',
  grid: 'grid',
  only_mine: 'silhouette'
}

/**
 * @param {string} name
 * @returns {string | null}
 */
export const get_preference_icon = name => preference_icon[name] ?? null
