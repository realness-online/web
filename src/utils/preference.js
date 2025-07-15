import { useStorage as storage } from '@vueuse/core'

export const fill = storage('fill', true) // ⇧f
export const stroke = storage('stroke', false) // ⇧s
export const cutout = storage('cutout', true) // ⇧c
export const background = storage('background', true) // ⇧b
export const drama = storage('drama', false) // ⇧l
export const animate = storage('animate', false) // ⇧a
export const fps = storage('fps', false) // ⇧d
export const storytelling = storage('storytelling', false) // ⇧w

// Layer visibility preferences
export const bold = storage('bold', true) // Z
export const medium = storage('medium', true) // X
export const regular = storage('regular', true) // C
export const light = storage('light', true) // V

// export const dash = storage('dash', false) // ⇧d // animate dash
// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
