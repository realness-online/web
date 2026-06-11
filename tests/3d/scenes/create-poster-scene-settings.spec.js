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
    apply_stroke_visibility: vi.fn(),
    apply_stroke_opacity: vi.fn(),
    apply_atmosphere: vi.fn()
  })

  it('get_settings mirrors state', () => {
    const state = {
      mosaic_spread: 1,
      mosaic_opacity: 2,
      shadow_spread: 3,
      shadow_opacity: 4,
      mosaic_visible: true,
      shadow_visible: false,
      stroke_visible: true,
      group_gap: 5,
      tilt_amount: 6,
      gyro_amount: 7,
      atmosphere_enabled: true,
      atmosphere_color: '#000',
      atmosphere_density: 8,
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
      stroke_visible: true,
      group_gap: 5,
      tilt_amount: 6,
      gyro_amount: 7,
      atmosphere_enabled: true,
      atmosphere_color: '#000',
      atmosphere_density: 8,
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
      stroke_visible: false,
      group_gap: 0,
      tilt_amount: 0,
      gyro_amount: 0,
      atmosphere_enabled: false,
      atmosphere_color: '',
      atmosphere_density: 0,
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
    settings.set_atmosphere_enabled(true)
    settings.set_mosaic_layer_visible('boulders', false)
    settings.set_shadow_layer_visible('bold', false)
    settings.set_stroke_visible(true)

    expect(state.mosaic_spread).toBe(0.5)
    expect(appliers.apply_mosaic_spread).toHaveBeenCalled()
    expect(appliers.apply_shadow_z).toHaveBeenCalled()
    expect(appliers.apply_atmosphere).toHaveBeenCalled()
    expect(appliers.apply_mosaic_visibility).toHaveBeenCalled()
    expect(appliers.apply_stroke_visibility).toHaveBeenCalled()
    expect(appliers.apply_stroke_opacity).toHaveBeenCalled()
    expect(state.mosaic_layer_visible.boulders).toBe(false)
    expect(state.shadow_layer_visible.bold).toBe(false)
  })

  it('skips appliers when guarded setters receive the same value', () => {
    const state = {
      mosaic_spread: 1,
      mosaic_opacity: 0,
      shadow_spread: 2,
      shadow_opacity: 0,
      mosaic_visible: true,
      shadow_visible: true,
      stroke_visible: true,
      group_gap: 3,
      tilt_amount: 4,
      gyro_amount: 5,
      atmosphere_enabled: true,
      atmosphere_color: '#fff',
      atmosphere_density: 6,
      drift_amount: 7,
      drift_speed: 8,
      breathing_amount: 9,
      breathing_speed: 10,
      motion_enabled: true,
      mosaic_layer_visible: {},
      shadow_layer_visible: {}
    }
    const appliers = make_appliers()
    const settings = create_poster_scene_settings(state, appliers)

    settings.set_mosaic_spread(1)
    settings.set_shadow_spread(2)
    settings.set_mosaic_visible(true)
    settings.set_shadow_visible(true)
    settings.set_stroke_visible(true)
    settings.set_group_gap(3)
    settings.set_atmosphere_enabled(true)
    settings.set_atmosphere_color('#fff')
    settings.set_atmosphere_density(6)
    settings.set_tilt_amount(4)
    settings.set_gyro_amount(5)
    settings.set_drift_amount(7)
    settings.set_drift_speed(8)
    settings.set_breathing_amount(9)
    settings.set_breathing_speed(10)
    settings.set_motion_enabled(true)

    expect(appliers.apply_mosaic_spread).not.toHaveBeenCalled()
    expect(appliers.apply_shadow_z).not.toHaveBeenCalled()
    expect(appliers.apply_mosaic_visibility).not.toHaveBeenCalled()
    expect(appliers.apply_shadow_visibility).not.toHaveBeenCalled()
    expect(appliers.apply_atmosphere).not.toHaveBeenCalled()
  })

  it('updates motion and atmosphere setters when values change', () => {
    const state = {
      mosaic_spread: 0,
      mosaic_opacity: 0,
      shadow_spread: 0,
      shadow_opacity: 0,
      mosaic_visible: false,
      shadow_visible: false,
      stroke_visible: false,
      group_gap: 0,
      tilt_amount: 0,
      gyro_amount: 0,
      atmosphere_enabled: false,
      atmosphere_color: '#000',
      atmosphere_density: 0,
      drift_amount: 0,
      drift_speed: 0,
      breathing_amount: 0,
      breathing_speed: 0,
      motion_enabled: false,
      mosaic_layer_visible: {},
      shadow_layer_visible: {}
    }
    const appliers = make_appliers()
    const settings = create_poster_scene_settings(state, appliers)

    settings.set_shadow_visible(true)
    settings.set_group_gap(0.4)
    settings.set_atmosphere_color('#abc')
    settings.set_tilt_amount(0.2)
    settings.set_gyro_amount(0.3)
    settings.set_drift_amount(0.1)
    settings.set_drift_speed(0.05)
    settings.set_breathing_amount(0.15)
    settings.set_breathing_speed(0.25)
    settings.set_motion_enabled(true)

    expect(state.shadow_visible).toBe(true)
    expect(state.group_gap).toBe(0.4)
    expect(state.atmosphere_color).toBe('#abc')
    expect(state.motion_enabled).toBe(true)
    expect(appliers.apply_shadow_visibility).toHaveBeenCalled()
    expect(appliers.apply_shadow_z).toHaveBeenCalled()
    expect(appliers.apply_atmosphere).toHaveBeenCalled()
  })

  it('set_mosaic_opacity always runs applier even when value unchanged', () => {
    const state = {
      mosaic_spread: 0,
      mosaic_opacity: 0.5,
      shadow_spread: 0,
      shadow_opacity: 0,
      mosaic_visible: true,
      shadow_visible: true,
      stroke_visible: true,
      group_gap: 0,
      tilt_amount: 0,
      gyro_amount: 0,
      atmosphere_enabled: false,
      atmosphere_color: '',
      atmosphere_density: 0,
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
