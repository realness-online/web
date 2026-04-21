import { useStorage as storage } from '@vueuse/core'
import { DEFAULT_ANIMATION_SPEED } from '@/utils/animation-config'

export const animate = storage('animate', false)
export const drama = storage('drama', false)
export const drama_back = storage('drama_back', false)
export const drama_front = storage('drama_front', false)

export const shadow = storage('shadow', true)
export const stroke = storage('stroke', true)
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

export const animation_speed = storage(
  'animation_speed',
  DEFAULT_ANIMATION_SPEED
)

export const grid_overlay = storage('grid_overlay', false)
export const aspect_ratio_mode = storage('aspect_ratio_mode', 'auto')
export const slice_alignment = storage('slice_alignment', 'ymid')

export const menu = storage('menu', true)
export const footer_visible = storage('footer_visible', true)

export const sync_folder = storage('sync_folder', false)

/** 'poster' uses a square PNG saved from a poster (IndexedDB); falls back to brand until one exists. */
export const homescreen_icon = storage('homescreen_icon', 'poster')

// export const adobe = storage('adobe', false)
// export const simple = storage('simple', false)
// export const filesystem = storage('filesystem', false)
