import { useStorage as storage } from '@vueuse/core'

export const fill = storage('fill', true)
export const stroke = storage('stroke', false)

export const animate = storage('animate', false)
export const emboss = storage('emboss', true)
export const light = storage('light', true)

export const adobe = storage('adobe', false)
export const simple = storage('simple', false)
export const filesystem = storage('filesystem', false)
