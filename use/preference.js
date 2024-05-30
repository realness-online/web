import { useStorage as storage } from '@vueuse/core'

export const fill = storage('fill', true) // f // automatically take first letter
export const stroke = storage('stroke', false) // s
export const aspect = storage('aspect-ratio', '16 / 9') // r automaticlly take first letter after dash

export const animate = storage('animate', false) // a
export const dash = storage('animate-dash', false) // d

export const emboss = storage('emboss', false) // e
export const light = storage('emboss-light', false) // l

export const adobe = storage('adobe', false)
export const simple = storage('simple', false)
export const filesystem = storage('filesystem', false)
export const fps = storage('fps', false) // d

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
  'F12'
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
