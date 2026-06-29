import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { nextTick } from 'vue'

// localStorage is already mocked by tests/mocks/browser/localStorage.js
// with an in-memory store cleared in beforeEach. @vueuse/core's useStorage
// reads/writes localStorage via Vue's watch scheduler — writes are async
// so we await nextTick() to flush watchers before checking storage.

import {
  animate,
  drama,
  drama_back,
  drama_front,
  shadow,
  stroke,
  mosaic,
  bold,
  medium,
  regular,
  light,
  background,
  boulders,
  rocks,
  gravel,
  sand,
  sediment,
  geology_layer_prefs,
  enable_geology_layers,
  enable_shadow_layers,
  info,
  storytelling,
  only_mine,
  animation_speed,
  grid,
  aspect_ratio_mode,
  slice_alignment,
  menu,
  footer_visible,
  sync_folder,
  notifications,
  view_3d,
  mosaic_spread,
  mosaic_opacity,
  shadow_spread,
  shadow_opacity,
  group_gap,
  tilt_amount,
  gyro_amount,
  atmosphere_enabled,
  atmosphere_color,
  atmosphere_density,
  drift_amount,
  drift_speed,
  breathing_amount,
  breathing_speed,
  reset_preferences
} from '@/utils/preference'

import {
  DEFAULT_MOSAIC_SPREAD,
  DEFAULT_MOSAIC_OPACITY,
  DEFAULT_SHADOW_SPREAD,
  DEFAULT_SHADOW_OPACITY,
  DEFAULT_GROUP_GAP,
  DEFAULT_TILT_AMOUNT,
  DEFAULT_GYRO_AMOUNT,
  DEFAULT_ATMOSPHERE_COLOR,
  DEFAULT_ATMOSPHERE_DENSITY,
  DEFAULT_DRIFT_AMOUNT,
  DEFAULT_DRIFT_SPEED,
  DEFAULT_BREATHING_AMOUNT,
  DEFAULT_BREATHING_SPEED
} from '@/utils/preference-defaults'

describe('@/utils/preference', () => {
  // The in-memory localStorage is cleared by tests/mocks/browser/localStorage.js
  // beforeEach, so each test starts empty — useStorage falls back to its default.

  describe('boolean preferences defaulting to false', () => {
    it.each([
      ['animate', animate],
      ['drama', drama],
      ['drama_back', drama_back],
      ['drama_front', drama_front],
      ['info', info],
      ['storytelling', storytelling],
      ['only_mine', only_mine],
      ['grid', grid],
      ['sync_folder', sync_folder],
      ['notifications', notifications],
      ['view_3d', view_3d]
    ])('%s defaults to false', (_name, ref) => {
      expect(ref.value).toBe(false)
    })

    it.each([
      ['animate', animate, 'animate'],
      ['drama', drama, 'drama'],
      ['sync_folder', sync_folder, 'sync_folder'],
      ['notifications', notifications, 'notifications'],
      ['view_3d', view_3d, '3d']
    ])('%s persists value to localStorage', async (_name, ref, key) => {
      ref.value = true
      await nextTick()
      expect(JSON.parse(localStorage.getItem(key))).toBe(true)
    })
  })

  describe('boolean preferences defaulting to true', () => {
    it.each([
      ['shadow', shadow],
      ['stroke', stroke],
      ['mosaic', mosaic],
      ['bold', bold],
      ['medium', medium],
      ['regular', regular],
      ['light', light],
      ['background', background],
      ['boulders', boulders],
      ['rocks', rocks],
      ['gravel', gravel],
      ['sand', sand],
      ['sediment', sediment],
      ['menu', menu],
      ['footer_visible', footer_visible],
      ['atmosphere_enabled', atmosphere_enabled]
    ])('%s defaults to true', (_name, ref) => {
      expect(ref.value).toBe(true)
    })

    it.each([
      ['shadow', shadow, 'shadow'],
      ['menu', menu, 'menu'],
      ['footer_visible', footer_visible, 'footer_visible']
    ])('%s persists value to localStorage', async (_name, ref, key) => {
      ref.value = false
      await nextTick()
      expect(JSON.parse(localStorage.getItem(key))).toBe(false)
    })
  })

  describe('string preferences', () => {
    it('animation_speed defaults to "stroll"', () => {
      expect(animation_speed.value).toBe('stroll')
    })

    it('aspect_ratio_mode defaults to "auto"', () => {
      expect(aspect_ratio_mode.value).toBe('auto')
    })

    it('slice_alignment defaults to "ymid"', () => {
      expect(slice_alignment.value).toBe('ymid')
    })

    it('atmosphere_color defaults to the dark surface color', () => {
      expect(atmosphere_color.value).toBe(DEFAULT_ATMOSPHERE_COLOR)
    })

    it('persists string value to localStorage', async () => {
      animation_speed.value = 'fast'
      await nextTick()
      expect(localStorage.getItem('animation_speed')).toBe('fast')
    })
  })

  describe('numeric preferences', () => {
    it.each([
      ['mosaic_spread', mosaic_spread, DEFAULT_MOSAIC_SPREAD],
      ['mosaic_opacity', mosaic_opacity, DEFAULT_MOSAIC_OPACITY],
      ['shadow_spread', shadow_spread, DEFAULT_SHADOW_SPREAD],
      ['shadow_opacity', shadow_opacity, DEFAULT_SHADOW_OPACITY],
      ['group_gap', group_gap, DEFAULT_GROUP_GAP],
      ['tilt_amount', tilt_amount, DEFAULT_TILT_AMOUNT],
      ['gyro_amount', gyro_amount, DEFAULT_GYRO_AMOUNT],
      ['atmosphere_density', atmosphere_density, DEFAULT_ATMOSPHERE_DENSITY],
      ['drift_amount', drift_amount, DEFAULT_DRIFT_AMOUNT],
      ['drift_speed', drift_speed, DEFAULT_DRIFT_SPEED],
      ['breathing_amount', breathing_amount, DEFAULT_BREATHING_AMOUNT],
      ['breathing_speed', breathing_speed, DEFAULT_BREATHING_SPEED]
    ])('%s defaults to the correct value', (_name, ref, expected) => {
      expect(ref.value).toBe(expected)
    })

    it.each([
      ['mosaic_spread', mosaic_spread, 'mosaic_spread', 0.5],
      ['tilt_amount', tilt_amount, 'tilt_amount', 1]
    ])('%s persists value to localStorage', async (_name, ref, key, val) => {
      ref.value = val
      await nextTick()
      expect(JSON.parse(localStorage.getItem(key))).toBe(val)
    })
  })

  describe('reset_preferences', () => {
    it('resets all preferences to their defaults', () => {
      animate.value = true
      drama.value = true
      shadow.value = false
      stroke.value = false
      mosaic.value = false
      bold.value = false
      medium.value = false
      regular.value = false
      light.value = false
      background.value = false
      boulders.value = false
      rocks.value = false
      gravel.value = false
      sand.value = false
      sediment.value = false
      info.value = true
      storytelling.value = true
      only_mine.value = true
      animation_speed.value = 'fast'
      grid.value = true
      aspect_ratio_mode.value = 'manual'
      slice_alignment.value = 'xmid'
      menu.value = false
      footer_visible.value = false
      sync_folder.value = true
      notifications.value = true
      view_3d.value = true
      mosaic_spread.value = 0.5
      mosaic_opacity.value = 0.5
      shadow_spread.value = 0.5
      shadow_opacity.value = 0.5
      group_gap.value = 0.5
      tilt_amount.value = 0.5
      gyro_amount.value = 0.5
      atmosphere_enabled.value = false
      atmosphere_color.value = '#ffffff'
      atmosphere_density.value = 0.5
      drift_amount.value = 0.5
      drift_speed.value = 0.5
      breathing_amount.value = 0.5
      breathing_speed.value = 0.5

      reset_preferences()

      expect(animate.value).toBe(false)
      expect(drama.value).toBe(false)
      expect(drama_back.value).toBe(false)
      expect(drama_front.value).toBe(false)
      expect(shadow.value).toBe(true)
      expect(stroke.value).toBe(true)
      expect(mosaic.value).toBe(true)
      expect(bold.value).toBe(true)
      expect(medium.value).toBe(true)
      expect(regular.value).toBe(true)
      expect(light.value).toBe(true)
      expect(background.value).toBe(true)
      expect(boulders.value).toBe(true)
      expect(rocks.value).toBe(true)
      expect(gravel.value).toBe(true)
      expect(sand.value).toBe(true)
      expect(sediment.value).toBe(true)
      expect(info.value).toBe(false)
      expect(storytelling.value).toBe(false)
      expect(only_mine.value).toBe(false)
      expect(animation_speed.value).toBe('stroll')
      expect(grid.value).toBe(false)
      expect(aspect_ratio_mode.value).toBe('auto')
      expect(slice_alignment.value).toBe('ymid')
      expect(menu.value).toBe(true)
      expect(footer_visible.value).toBe(true)
      expect(sync_folder.value).toBe(false)
      expect(notifications.value).toBe(false)
      expect(view_3d.value).toBe(false)
      expect(mosaic_spread.value).toBe(DEFAULT_MOSAIC_SPREAD)
      expect(mosaic_opacity.value).toBe(DEFAULT_MOSAIC_OPACITY)
      expect(shadow_spread.value).toBe(DEFAULT_SHADOW_SPREAD)
      expect(shadow_opacity.value).toBe(DEFAULT_SHADOW_OPACITY)
      expect(group_gap.value).toBe(DEFAULT_GROUP_GAP)
      expect(tilt_amount.value).toBe(DEFAULT_TILT_AMOUNT)
      expect(gyro_amount.value).toBe(DEFAULT_GYRO_AMOUNT)
      expect(atmosphere_enabled.value).toBe(true)
      expect(atmosphere_color.value).toBe(DEFAULT_ATMOSPHERE_COLOR)
      expect(atmosphere_density.value).toBe(DEFAULT_ATMOSPHERE_DENSITY)
      expect(drift_amount.value).toBe(DEFAULT_DRIFT_AMOUNT)
      expect(drift_speed.value).toBe(DEFAULT_DRIFT_SPEED)
      expect(breathing_amount.value).toBe(DEFAULT_BREATHING_AMOUNT)
      expect(breathing_speed.value).toBe(DEFAULT_BREATHING_SPEED)
    })
  })

  describe('enable_geology_layers', () => {
    it('sets all geology prefs to true', () => {
      boulders.value = false
      rocks.value = false
      gravel.value = false
      sand.value = false
      sediment.value = false

      enable_geology_layers()

      expect(boulders.value).toBe(true)
      expect(rocks.value).toBe(true)
      expect(gravel.value).toBe(true)
      expect(sand.value).toBe(true)
      expect(sediment.value).toBe(true)
    })
  })

  describe('enable_shadow_layers', () => {
    it('sets all shadow prefs to true', () => {
      bold.value = false
      medium.value = false
      regular.value = false
      light.value = false
      background.value = false

      enable_shadow_layers()

      expect(bold.value).toBe(true)
      expect(medium.value).toBe(true)
      expect(regular.value).toBe(true)
      expect(light.value).toBe(true)
      expect(background.value).toBe(true)
    })
  })

  describe('geology_layer_prefs', () => {
    it('is an object mapping layer names to their refs', () => {
      expect(geology_layer_prefs.boulders).toBe(boulders)
      expect(geology_layer_prefs.rocks).toBe(rocks)
      expect(geology_layer_prefs.gravel).toBe(gravel)
      expect(geology_layer_prefs.sand).toBe(sand)
      expect(geology_layer_prefs.sediment).toBe(sediment)
    })
  })
})
