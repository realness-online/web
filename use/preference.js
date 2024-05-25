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
