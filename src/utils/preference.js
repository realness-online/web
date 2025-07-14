import { useStorage as storage } from '@vueuse/core'

export const fill = storage('fill', true) // ⇧f
export const stroke = storage('stroke', false) // ⇧s
export const cutout = storage('cutout', true) // ⇧c
export const background = storage('background', true) // ⇧b
export const light = storage('light', false) // ⇧l
export const animate = storage('animate', false) // ⇧a
export const fps = storage('fps', false) // ⇧d
export const storytelling = storage('storytelling', false) // ⇧w

// Layer visibility preferences
export const bold_layer = storage('bold_layer', true) // Z
export const medium_layer = storage('medium_layer', true) // X
export const regular_layer = storage('regular_layer', true) // C
export const light_layer = storage('light_layer', true) // V

// export const dash = storage('dash', false) // ⇧d // animate dash
// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
