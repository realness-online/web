import * as THREE from 'three'
import { parse_svg_layers } from '../utils/load-svg-layers.js'
import { add_poster_mosaic_layers } from './add-poster-mosaic-layers.js'
import { add_poster_scene_lights } from './add-poster-scene-lights.js'
import { add_poster_shadow_layers } from './add-poster-shadow-layers.js'
import { create_poster_scene_settings } from './create-poster-scene-settings.js'
import { create_poster_scene_update } from './create-poster-scene-update.js'
import { export_poster_glb } from './export-poster-glb.js'
import {
  FIT_HEIGHT,
  INITIAL_BREATHING_AMOUNT,
  INITIAL_BREATHING_SPEED,
  INITIAL_DRIFT_AMOUNT,
  INITIAL_DRIFT_SPEED,
  INITIAL_GROUP_GAP,
  INITIAL_GYRO_AMOUNT,
  INITIAL_HAZE_COLOR,
  INITIAL_HAZE_DENSITY,
  INITIAL_HAZE_ENABLED,
  INITIAL_MOSAIC_OPACITY,
  INITIAL_MOSAIC_SPREAD,
  INITIAL_MOTION_ENABLED,
  INITIAL_SHADOW_OPACITY,
  INITIAL_SHADOW_SPREAD,
  INITIAL_TILT_AMOUNT,
  INITIAL_ZOOM,
  SCENE_BACKGROUND,
  SHADOW_Z_GAIN,
  VECTOR_LAYERS
} from './poster-scene-config.js'

/**
 * @param {string} svg_string
 * @returns {import('../engine/types.js').PosterSceneController}
 */
export const create_poster_scene = svg_string => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SCENE_BACKGROUND)
  scene.fog = new THREE.FogExp2(INITIAL_HAZE_COLOR, 0)

  add_poster_scene_lights(scene)

  const root = new THREE.Group()
  scene.add(root)

  const { width, height, layers } = parse_svg_layers(
    svg_string,
    VECTOR_LAYERS.map(layer => layer.name)
  )

  const scale = FIT_HEIGHT / height
  const plane_w = width * scale
  const plane_h = height * scale
  const layer_groups = []
  const mosaic_group_map = new Map()
  const mosaic_materials = []
  const mosaic_layer_visible = /** @type {Record<string, boolean>} */ ({})

  add_poster_mosaic_layers({
    root,
    layers,
    width,
    height,
    scale,
    layer_groups,
    mosaic_group_map,
    mosaic_materials,
    mosaic_layer_visible
  })

  const state = {
    mosaic_spread: INITIAL_MOSAIC_SPREAD,
    mosaic_opacity: INITIAL_MOSAIC_OPACITY,
    shadow_spread: INITIAL_SHADOW_SPREAD,
    shadow_opacity: INITIAL_SHADOW_OPACITY,
    mosaic_visible: true,
    shadow_visible: true,
    group_gap: INITIAL_GROUP_GAP,
    tilt_amount: INITIAL_TILT_AMOUNT,
    gyro_amount: INITIAL_GYRO_AMOUNT,
    haze_enabled: INITIAL_HAZE_ENABLED,
    haze_color: INITIAL_HAZE_COLOR,
    haze_density: INITIAL_HAZE_DENSITY,
    drift_amount: INITIAL_DRIFT_AMOUNT,
    drift_speed: INITIAL_DRIFT_SPEED,
    breathing_amount: INITIAL_BREATHING_AMOUNT,
    breathing_speed: INITIAL_BREATHING_SPEED,
    motion_enabled: INITIAL_MOTION_ENABLED,
    mosaic_layer_visible,
    shadow_layer_visible: /** @type {Record<string, boolean>} */ ({})
  }

  const shadow_entries = []
  const shadow_group_map = new Map()
  const shadow_materials = []

  const appliers = {
    apply_mosaic_spread() {
      let i = 0
      for (const group of mosaic_group_map.values()) {
        group.position.z = i * i * state.mosaic_spread
        i++
      }
    },
    apply_mosaic_opacity() {
      for (const entry of mosaic_materials)
        entry.material.opacity = entry.base_opacity * state.mosaic_opacity
    },
    apply_mosaic_visibility() {
      for (const [name, group] of mosaic_group_map)
        group.visible = state.mosaic_visible && state.mosaic_layer_visible[name]
    },
    apply_shadow_visibility() {
      for (const [child_id, group] of shadow_group_map)
        group.visible =
          state.shadow_visible && state.shadow_layer_visible[child_id]
    },
    apply_shadow_opacity() {
      for (const entry of shadow_materials)
        if (entry.loaded)
          entry.material.opacity = entry.base_opacity * state.shadow_opacity
    },
    apply_shadow_z() {
      for (const entry of shadow_entries)
        entry.group.position.z =
          entry.parallax_offset * state.shadow_spread * SHADOW_Z_GAIN -
          state.group_gap
    },
    apply_haze() {
      scene.fog.color.set(state.haze_color)
    }
  }

  appliers.apply_mosaic_spread()
  appliers.apply_haze()

  const texture_promises = add_poster_shadow_layers({
    svg_string,
    root,
    plane_w,
    plane_h,
    shadow_spread: state.shadow_spread,
    group_gap: state.group_gap,
    shadow_opacity: state.shadow_opacity,
    layer_groups,
    shadow_entries,
    shadow_group_map,
    shadow_materials,
    shadow_layer_visible: state.shadow_layer_visible
  })

  const smooth = { x: 0, y: 0 }
  const zoom = { target: INITIAL_ZOOM, current: INITIAL_ZOOM }
  const tilt = { x: 0, y: 0 }
  const pointer = { x: 0, y: 0 }

  /** @type {THREE.PerspectiveCamera | null} */
  let camera_ref = null
  const camera = { canvas_height: 1 }
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const z_plane = new THREE.Plane()
  const cursor_before = new THREE.Vector3()
  const cursor_after = new THREE.Vector3()

  const raycast = {
    cursor_before,
    cursor_after,
    world_cursor_at_z(z, out) {
      if (!camera_ref) return null
      ndc.set(pointer.x, -pointer.y)
      raycaster.setFromCamera(ndc, camera_ref)
      z_plane.setComponents(0, 0, 1, -z)
      return raycaster.ray.intersectPlane(z_plane, out)
    }
  }

  const update = create_poster_scene_update({
    scene,
    root,
    layer_groups,
    get_mosaic_spread: () => state.mosaic_spread,
    get_shadow_spread: () => state.shadow_spread,
    get_motion_enabled: () => state.motion_enabled,
    get_drift_amount: () => state.drift_amount,
    get_drift_speed: () => state.drift_speed,
    get_breathing_amount: () => state.breathing_amount,
    get_breathing_speed: () => state.breathing_speed,
    get_tilt_amount: () => state.tilt_amount,
    get_gyro_amount: () => state.gyro_amount,
    get_haze_enabled: () => state.haze_enabled,
    get_haze_density: () => state.haze_density,
    smooth,
    zoom,
    tilt,
    pointer,
    camera,
    raycast
  })

  const settings = create_poster_scene_settings(state, appliers)

  return {
    scene,
    mount({ camera } = {}) {
      camera_ref = camera || null
    },
    on_resize({ height } = {}) {
      if (height) camera.canvas_height = height
    },
    update,
    ...settings,
    wait_for_textures() {
      return Promise.all(texture_promises)
    },
    export_glb(filename = 'poster') {
      export_poster_glb(scene, filename)
    }
  }
}
