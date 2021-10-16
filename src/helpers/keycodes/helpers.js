
const FORBIDDEN_NODES = ['INPUT', 'TEXTAREA', 'SELECT']

const are_objects_equal = (a, b) =>
  Object.entries(a).every(([key, value]) => b[key] === value)

export const split_combination = combination => {
  combination = combination.replace(/\s/g, '')
  combination = combination.includes('numpad+')
    ? combination.replace('numpad+', 'numpadadd')
    : combination
  combination = combination.includes('++')
    ? combination.replace('++', '+=')
    : combination
  return combination.split(/\+{1}/)
}

export const return_char_code = key => key.length === 1 ? key.charCodeAt(0) : undefined

const get_hotkey_callback = (key_map, key_code, event_key_modifiers) => {
  const key = key_map.find(({ code, modifiers }) =>
    code === key_code && are_objects_equal(event_key_modifiers, modifiers)
  )
  if (!key) return false
  return key.callback
}

export const assign_key_handler = (e, key_map, modifiers) => {
  const { keyCode: key_code, ctrlKey, altKey, shiftKey, metaKey } = e
  const event_key_modifiers = { ctrlKey, altKey, shiftKey, metaKey }

  if (modifiers.prevent) {
    e.preventDefault()
  }

  if (modifiers.stop) {
    e.stopPropagation()
  }

  const { nodeName: name, isContentEditable: editable } = document.activeElement
  if (editable || FORBIDDEN_NODES.includes(name)) return

  const callback = get_hotkey_callback(keyMap, key_code, event_key_modifiers)
  if (!callback) return e
  e.preventDefault()
  callback[e.type](e)
}
