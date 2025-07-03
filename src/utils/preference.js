import { useStorage as storage } from '@vueuse/core'

export const fill = storage('fill', true) // ⇧f
export const stroke = storage('stroke', false) // ⇧s

export const animate = storage('animate', false) // ⇧a
export const fps = storage('fps', false) // ⇧d

export const cutout = storage('cutout', true) // ⇧c
export const light = storage('light', false) // ⇧l

// export const dash = storage('dash', false) // ⇧d // animate dash
// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
