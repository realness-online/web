/**
 * A read-only view of every key command the app supports, grouped by where it
 * applies. Built from `default_keymap` and the live listeners, so the page
 * cannot drift from what the keys actually do.
 *
 * `owner` is who claims the key:
 * - 'keymap'   the binding in `default_keymap`, run by the key-commands plugin
 * - 'listener' a raw window listener mounted by a view or component
 */

import { default_keymap, get_command_description } from '@/utils/keymaps'

/** @typedef {import('@/types').Keymap_Context} Keymap_Context */

/**
 * @typedef {Object} Key_Entry
 * @property {string} key - How the key is written on screen
 * @property {string} command - Command identifier, or '' for a raw listener
 * @property {string} description - What it does
 * @property {string} owner - 'keymap' or 'listener'
 * @property {boolean} reachable - Whether the binding can actually fire
 * @property {string} [note] - Why it is unreachable, or other caveat
 */

/**
 * @typedef {Object} Key_Group
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string} scope - When the keys are live
 * @property {string[]} constraints - Conditions on this group
 * @property {Key_Entry[]} entries
 */

/** Raw listeners that live outside `default_keymap`. Keyed by view or owner. */
const LISTENERS = [
  {
    id: 'chat',
    title: 'Chat pane',
    summary: 'Keys the chat panel handles while it shows.',
    scope: 'Chat is showing.',
    constraints: [],
    keys: [
      ['Option+Tab', 'Move between chat and the terminal'],
      ['Escape', 'Leave chat'],
      ['Cmd+K', 'Clear the conversation'],
      ['/', 'Chat commands: stop, new, compact, model, thinking, copy'],
      ['G', 'Jump to the newest message']
    ]
  },
  {
    id: 'terminal',
    title: 'Terminal',
    summary: 'Keys the terminal canvas handles itself.',
    scope: 'The terminal is showing and its canvas has focus.',
    constraints: [
      'The canvas is tabindex="0" but has no visible focus ring, so it ' +
        'cannot be reached by Tab.',
      'With the canvas unfocused the global keys stay live, so a bare key ' +
        'meant for the shell runs an app command instead.'
    ],
    keys: [['Any', 'Sent to the shell while the canvas has focus']]
  }
]

const KEY_GROUPS = [
  {
    id: 'appearance',
    title: 'Poster appearance',
    summary: 'What a poster looks like. Option+Space, then the key.',
    scope: 'Any screen, even while typing: the panel takes one key.',
    constraints: [
      'Never bare: a key alone types, or reaches the focused terminal.'
    ],
    commands: [
      'pref::Toggle_Mosaic',
      'pref::Toggle_Shadow',
      'pref::Toggle_Stroke',
      'pref::Toggle_Drama',
      'pref::Cycle_Drama',
      'pref::Toggle_Animate',
      'pref::Cycle_Animation_Speed',
      'pref::Cycle_Aspect_Ratio',
      'pref::Toggle_Morph',
      'pref::Toggle_Background',
      'pref::Toggle_Bold',
      'pref::Toggle_Medium',
      'pref::Toggle_Regular',
      'pref::Toggle_Light',
      'pref::Toggle_Boulders',
      'pref::Toggle_Rocks',
      'pref::Toggle_Gravel',
      'pref::Toggle_Sand',
      'pref::Toggle_Sediment'
    ]
  },
  {
    id: 'view',
    title: 'View',
    summary: 'Chrome, overlays, and the 3D viewer. Option+Space, then the key.',
    scope: 'Any screen, even while typing: the panel takes one key.',
    constraints: ['Aspect ratio also takes Shift to go backwards.'],
    commands: [
      'pref::Toggle_Info',
      'pref::Toggle_Storytelling',
      'pref::Toggle_View_3d',
      'pref::Toggle_Grid',
      'pref::Toggle_Menu',
      'pref::Toggle_Footer',
      'ui::Toggle_Presentation',
      'ui::Open_Settings',
      'ui::Open_Account',
      'ui::Show_Documentation'
    ]
  },
  {
    id: 'home',
    title: 'Views',
    summary:
      'Backquote toggles chat. Option+key, or Option+Space then the key.',
    scope: 'Any screen, even while typing. Chat needs sign-in.',
    constraints: ['Terminal layouts wait for a wide screen.'],
    commands: ['view::Toggle_Chat']
  },
  {
    id: 'unbound',
    title: 'No default key',
    summary: 'Commands that work but have no key today.',
    scope: 'Only by a custom binding.',
    constraints: [
      'These are in `preference_command`, so a binding can reach them, but ' +
        'nothing binds them by default.'
    ],
    commands: [
      'pref::Toggle_Color_Cycle',
      'pref::Toggle_Only_Mine',
      'ui::Clear_Sync_Time'
    ]
  },
  {
    id: 'navigation',
    title: 'Page navigation',
    summary:
      'Leave the current view for another page. Option+Space, then the key.',
    scope: 'Any screen, even while typing: the panel takes one key.',
    constraints: [
      'Chat and terminal require sign-in. Terminal needs a wide screen.'
    ],
    commands: [
      'nav::Go_Thoughts',
      'nav::Go_Terminal',
      'nav::Go_Account',
      'nav::Go_About',
      'nav::Go_Docs',
      'nav::Go_Prints',
      'nav::Go_Pricing',
      'nav::Go_Legal'
    ]
  }
]

/**
 * @param {Keymap_Context[]} keymap
 * @returns {Map<string, string[]>} command to the keys bound to it
 */
const keys_by_command = (keymap = default_keymap) => {
  /** @type {Map<string, string[]>} */
  const map = new Map()
  for (const context_config of keymap)
    for (const [key, binding] of Object.entries(
      context_config.bindings || {}
    )) {
      if (!binding) continue
      const command = Array.isArray(binding) ? binding[0] : binding
      const keys = map.get(command) ?? []
      keys.push(key)
      map.set(command, keys)
    }
  return map
}

const is_modifier = key => key.includes('ctrl-') || key.includes('alt-')

/**
 * Build one group's rows from the keymap.
 * @param {{ id: string, commands: string[] }} group
 * @returns {Key_Entry[]}
 */
const entries_for = group => {
  const bound = keys_by_command()
  const rows = []
  for (const command of group.commands) {
    const keys = bound.get(command) ?? []
    if (!keys.length) {
      rows.push({
        key: '',
        command,
        description: get_command_description(command),
        owner: 'keymap',
        reachable: false,
        note: 'no default binding'
      })
      continue
    }
    for (const key of keys)
      rows.push({
        key,
        command,
        description: get_command_description(command),
        owner: 'keymap',
        reachable: !is_modifier(key)
      })
  }
  return rows
}

/**
 * The whole page as groups of rows, keymap-backed and listener-backed.
 * @param {Keymap_Context[]} [keymap]
 * @returns {Key_Group[]}
 */
export const key_overview = (keymap = default_keymap) => {
  const from_keymap = KEY_GROUPS.map((group, index) => ({
    id: group.id,
    title: group.title,
    summary: group.summary,
    scope: group.scope,
    constraints: group.constraints,
    entries: entries_for(group)
  }))

  const listeners = LISTENERS.map(listener => ({
    id: listener.id,
    title: listener.title,
    summary: listener.summary,
    scope: listener.scope,
    constraints: listener.constraints,
    entries: listener.keys.map(([key, description]) => ({
      key,
      command: '',
      description,
      owner: 'listener',
      reachable: true
    }))
  }))

  return [
    ...from_keymap.slice(0, 3),
    listeners[0],
    ...from_keymap.slice(3),
    listeners[1]
  ]
}

/** @returns {{ keys: number, commands: number, unbound: number }} */
export const key_overview_totals = (groups = key_overview()) => {
  const rows = groups.flatMap(group => group.entries)
  return {
    keys: rows.filter(row => row.key).length,
    commands: new Set(rows.map(row => row.command).filter(Boolean)).size,
    unbound: rows.filter(row => !row.key).length
  }
}

/**
 * @typedef {Object} Key_Cap_Entry
 * @property {string} group - Group id that claims the key
 * @property {string} title - Group title
 * @property {string} description
 * @property {string} command
 * @property {boolean} reachable
 * @property {string} [note]
 */

/** Keyboard layers, in the order the page offers them. */
export const KEY_LAYERS = ['plain', 'shift', 'option', 'cmd']

/** `alt-` and `ctrl-` combos map onto the Mac modifier they sit under. */
const DASH_LAYER = { alt: 'option', ctrl: 'cmd' }

/** Shifted symbols live on the key that types them unshifted. */
const SHIFTED = { '?': '/', '!': '1', '<': ',', '>': '.', ':': ';' }

/**
 * Where a key string lands on a physical keyboard.
 * `Option+1` → option/1, `Z` → shift/z, `ctrl-s` → cmd/s, `Escape` → plain/escape.
 * @param {string} key
 * @returns {{ layer: string, cap: string } | null} null for keys with no cap
 */
export const key_position = key => {
  if (!key || key === 'Any') return null
  const plus = key.match(/^(Option|Cmd|Ctrl|Shift)\+(.+)$/)
  if (plus) {
    const layer = plus[1] === 'Ctrl' ? 'cmd' : plus[1].toLowerCase()
    return { layer, cap: plus[2].toLowerCase() }
  }
  const dash = key.match(/^(ctrl|alt|cmd|shift)-(?:shift-)?(.+)$/)
  if (dash) {
    const layer = DASH_LAYER[dash[1]] ?? dash[1]
    return { layer, cap: dash[2].toLowerCase() }
  }
  if (SHIFTED[key]) return { layer: 'shift', cap: SHIFTED[key] }
  if (key.length === 1 && key !== key.toLowerCase())
    return { layer: 'shift', cap: key.toLowerCase() }
  return { layer: 'plain', cap: key.toLowerCase() }
}

/**
 * Every bound key, placed on its layer and cap. A cap with more than one
 * entry is a collision.
 * @param {Key_Group[]} [groups]
 * @returns {Record<string, Record<string, Key_Cap_Entry[]>>}
 */
export const keyboard_layers = (groups = key_overview()) => {
  /** @type {Record<string, Record<string, Key_Cap_Entry[]>>} */
  const layers = Object.fromEntries(KEY_LAYERS.map(layer => [layer, {}]))
  for (const group of groups)
    for (const entry of group.entries) {
      const position = key_position(entry.key)
      if (!position) continue
      const caps = layers[position.layer]
      if (!caps) continue
      ;(caps[position.cap] ??= []).push({
        group: group.id,
        title: group.title,
        description: entry.description,
        command: entry.command,
        reachable: entry.reachable,
        note: entry.note
      })
    }
  return layers
}
