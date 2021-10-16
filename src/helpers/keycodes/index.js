import codes from './codes'
import { split_combination, return_char_code } from './helpers'

const noop = () => {}

const default_modifiers = {
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false
}

const alternative_key_names = {
  option: 'alt',
  command: 'meta',
  return: 'enter',
  escape: 'esc',
  plus: '+',
  mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
}

export const get_key_map = (combinations, alias) => {
  const result = []
  Object.keys(combinations).forEach(combination => {
    const { keyup, keydown } = combinations[combination]
    const callback = {
      keydown: keydown || (keyup ? noop : combinations[combination]),
      keyup: keyup || noop
    }
    const keys = split_combination(combination)
    const { code, modifiers } = resolve_codes_and_modifiers(keys, alias)

    result.push({
      code,
      modifiers,
      callback
    })
  })
  return result
}

const resolve_codes_and_modifiers = (keys, alias) => {
  let modifiers = { ...default_modifiers }
  if (keys.length > 1) {
    return keys.reduce((acc, key) => {
      key = alternative_key_names[key] || key
      if (default_modifiers.hasOwnProperty(`${key}Key`)) {
        acc.modifiers = { ...acc.modifiers, [`${key}Key`]: true }
      } else {
        acc.code = alias[key] || searchKeyCode(key)
      }
      return acc
    }, { modifiers })
  }

  const key = alternative_key_names[keys[0]] || keys[0]
  if (default_modifiers.hasOwnProperty(`${key}Key`)) {
    modifiers = { ...modifiers, [`${key}Key`]: true }
  }
  const code = alias[key] || searchKeyCode(key)

  return {
    modifiers,
    code
  }
}

const search_key_Code = key => codes[key.toLowerCase()] || return_char_code(key)
