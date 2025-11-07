import { useStorage as storage } from '@vueuse/core'

export const animate = storage('animate', false)
export const drama = storage('drama', false)
export const drama_back = storage('drama_back', false)
export const drama_front = storage('drama_front', false)
export const slice = storage('slice', false)

export const fill = storage('fill', true)
export const stroke = storage('stroke', false)
export const cutout = storage('cutout', true)

export const bold = storage('bold', true)
export const medium = storage('medium', true)
export const regular = storage('regular', true)
export const light = storage('light', true)
export const background = storage('background', true)

export const boulder = storage('boulder', true)
export const rock = storage('rock', true)
export const gravel = storage('gravel', true)
export const sand = storage('sand', true)
export const sediment = storage('sediment', true)

export const info = storage('info', false)
export const storytelling = storage('storytelling', false)

export const animation_speed = storage('animation_speed', 'normal') //fast normal slow very_slow glacial

export const grid_overlay = storage('grid_overlay', false)

// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
