import { useStorage as storage } from '@vueuse/core'

export const animate = storage('animate', false)
export const drama = storage('drama', false)
export const drama_back = storage('drama_back', false)
export const drama_front = storage('drama_front', false)
export const slice = storage('slice', false)

export const shadow = storage('shadow', true)
export const stroke = storage('stroke', false)
export const mosaic = storage('mosaic', true)

export const bold = storage('bold', true)
export const medium = storage('medium', true)
export const regular = storage('regular', true)
export const light = storage('light', true)
export const background = storage('background', true)

export const boulders = storage('boulder', true)
export const rocks = storage('rock', true)
export const gravel = storage('gravel', true)
export const sand = storage('sand', true)
export const sediment = storage('sediment', true)

export const info = storage('info', false)
export const storytelling = storage('storytelling', false)

export const animation_speed = storage('animation_speed', 'normal') //fast normal slow very_slow glacial

export const grid_overlay = storage('grid_overlay', false)

export const aspect_ratio_mode = storage('aspect_ratio_mode', 'auto')

export const slice_alignment = storage('slice_alignment', 'ymid')

export const menu = storage('menu', true)

// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
