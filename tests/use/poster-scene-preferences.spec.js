import { ref, nextTick as tick } from 'vue'
import { vi } from 'vite-plus/test'
import {
  sync_poster_scene_preferences,
  use_poster_scene_preferences
} from '@/use/poster-scene-preferences'

vi.mock('@/utils/preference', () => ({
  animate: { value: true },
  mosaic: { value: true },
  shadow: { value: false },
  bold: { value: true },
  medium: { value: true },
  regular: { value: true },
  light: { value: true },
  background: { value: true },
  boulders: { value: true },
  rocks: { value: true },
  gravel: { value: true },
  sand: { value: true },
  sediment: { value: true },
  mosaic_spread: { value: 0.1 },
  mosaic_opacity: { value: 0.5 },
  shadow_spread: { value: 0.1 },
  shadow_opacity: { value: 0.5 },
  group_gap: { value: 0 },
  tilt_amount: { value: 1 },
  gyro_amount: { value: 1 },
  haze_enabled: { value: false },
  haze_color: { value: '#000' },
  haze_density: { value: 0 },
  drift_amount: { value: 0 },
  drift_speed: { value: 0 },
  breathing_amount: { value: 0 },
  breathing_speed: { value: 0 }
}))

describe('poster_scene_preferences', () => {
  it('sync_poster_scene_preferences applies prefs to scene', () => {
    const scene = {
      set_mosaic_visible: vi.fn(),
      set_shadow_visible: vi.fn(),
      set_mosaic_spread: vi.fn(),
      set_mosaic_opacity: vi.fn(),
      set_shadow_spread: vi.fn(),
      set_shadow_opacity: vi.fn(),
      set_group_gap: vi.fn(),
      set_tilt_amount: vi.fn(),
      set_gyro_amount: vi.fn(),
      set_haze_enabled: vi.fn(),
      set_haze_color: vi.fn(),
      set_haze_density: vi.fn(),
      set_mosaic_layer_visible: vi.fn(),
      set_shadow_layer_visible: vi.fn(),
      set_motion_enabled: vi.fn(),
      set_drift_amount: vi.fn(),
      set_drift_speed: vi.fn(),
      set_breathing_amount: vi.fn(),
      set_breathing_speed: vi.fn()
    }

    sync_poster_scene_preferences(scene)

    expect(scene.set_mosaic_visible).toHaveBeenCalledWith(true)
    expect(scene.set_shadow_visible).toHaveBeenCalledWith(false)
    expect(scene.set_motion_enabled).toHaveBeenCalledWith(true)
  })

  it('use_poster_scene_preferences reacts when scene ref is set', async () => {
    const scene_ref = ref(null)

    use_poster_scene_preferences(scene_ref)
    scene_ref.value = /** @type {any} */ ({
      set_mosaic_visible: vi.fn(),
      set_shadow_visible: vi.fn(),
      set_mosaic_spread: vi.fn(),
      set_mosaic_opacity: vi.fn(),
      set_shadow_spread: vi.fn(),
      set_shadow_opacity: vi.fn(),
      set_group_gap: vi.fn(),
      set_tilt_amount: vi.fn(),
      set_gyro_amount: vi.fn(),
      set_haze_enabled: vi.fn(),
      set_haze_color: vi.fn(),
      set_haze_density: vi.fn(),
      set_mosaic_layer_visible: vi.fn(),
      set_shadow_layer_visible: vi.fn(),
      set_motion_enabled: vi.fn(),
      set_drift_amount: vi.fn(),
      set_drift_speed: vi.fn(),
      set_breathing_amount: vi.fn(),
      set_breathing_speed: vi.fn()
    })
    await tick()

    expect(scene_ref.value.set_mosaic_visible).toHaveBeenCalled()
  })
})
