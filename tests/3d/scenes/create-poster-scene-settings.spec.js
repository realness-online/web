import { vi } from 'vite-plus/test'
import { create_poster_scene_settings } from '@/3d/scenes/create-poster-scene-settings.js'

describe('create_poster_scene_settings', () => {
  const make_appliers = () => ({
    apply_mosaic_spread: vi.fn(),
    apply_mosaic_opacity: vi.fn(),
    apply_shadow_z: vi.fn(),
    apply_shadow_opacity: vi.fn(),
    apply_mosaic_visibility: vi.fn(),
    apply_shadow_visibility: vi.fn(),
    apply_haze: vi.fn()
  })

  it('get_settings mirrors state', () => {
    const state = {
      mosaic_spread: 1,
      mosaic_opacity: 2,
      shadow_spread: 3,
      shadow_opacity: 4,
      mosaic_visible: true,
      shadow_visible: false,
      group_gap: 5,
      tilt_amount: 6,
      gyro_amount: 7,
      haze_enabled: true,
      haze_color: '#000',
      haze_density: 8,
      drift_amount: 9,
      drift_speed: 10,
      breathing_amount: 11,
      breathing_speed: 12,
      motion_enabled: true,
      mosaic_layer_visible: {},
      shadow_layer_visible: {}
    }
    const settings = create_poster_scene_settings(state, make_appliers())

    expect(settings.get_settings()).toEqual({
      mosaic_spread: 1,
      mosaic_opacity: 2,
      shadow_spread: 3,
      shadow_opacity: 4,
      mosaic_visible: true,
      shadow_visible: false,
      group_gap: 5,
      tilt_amount: 6,
      gyro_amount: 7,
      haze_enabled: true,
      haze_color: '#000',
      haze_density: 8,
      drift_amount: 9,
      drift_speed: 10,
      breathing_amount: 11,
      breathing_speed: 12,
      motion_enabled: true
    })
  })

  it('setters update state and call appliers', () => {
    const state = {
      mosaic_spread: 0,
      mosaic_opacity: 0,
      shadow_spread: 0,
      shadow_opacity: 0,
      mosaic_visible: false,
      shadow_visible: false,
      group_gap: 0,
      tilt_amount: 0,
      gyro_amount: 0,
      haze_enabled: false,
      haze_color: '',
      haze_density: 0,
      drift_amount: 0,
      drift_speed: 0,
      breathing_amount: 0,
      breathing_speed: 0,
      motion_enabled: false,
      mosaic_layer_visible: { boulders: true },
      shadow_layer_visible: { bold: true }
    }
    const appliers = make_appliers()
    const settings = create_poster_scene_settings(state, appliers)

    settings.set_mosaic_spread(0.5)
    settings.set_shadow_spread(0.2)
    settings.set_haze_enabled(true)
    settings.set_mosaic_layer_visible('boulders', false)
    settings.set_shadow_layer_visible('bold', false)

    expect(state.mosaic_spread).toBe(0.5)
    expect(appliers.apply_mosaic_spread).toHaveBeenCalled()
    expect(appliers.apply_shadow_z).toHaveBeenCalled()
    expect(appliers.apply_haze).toHaveBeenCalled()
    expect(appliers.apply_mosaic_visibility).toHaveBeenCalled()
    expect(state.mosaic_layer_visible.boulders).toBe(false)
    expect(state.shadow_layer_visible.bold).toBe(false)
  })

  it('set_mosaic_opacity always runs applier even when value unchanged', () => {
    const state = {
      mosaic_spread: 0,
      mosaic_opacity: 0.5,
      shadow_spread: 0,
      shadow_opacity: 0,
      mosaic_visible: true,
      shadow_visible: true,
      group_gap: 0,
      tilt_amount: 0,
      gyro_amount: 0,
      haze_enabled: false,
      haze_color: '',
      haze_density: 0,
      drift_amount: 0,
      drift_speed: 0,
      breathing_amount: 0,
      breathing_speed: 0,
      motion_enabled: true,
      mosaic_layer_visible: {},
      shadow_layer_visible: {}
    }
    const appliers = make_appliers()
    const settings = create_poster_scene_settings(state, appliers)

    settings.set_mosaic_opacity(0.5)

    expect(appliers.apply_mosaic_opacity).toHaveBeenCalledTimes(1)
  })
})
