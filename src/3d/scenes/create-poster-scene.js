import * as THREE from 'three'
import {
  parse_poster_svg,
  parse_svg_layers_from_context
} from '@/3d/utils/load-svg-layers.js'
import { add_poster_mosaic_layers } from '@/3d/scenes/add-poster-mosaic-layers.js'
import { add_poster_scene_lights } from '@/3d/scenes/add-poster-scene-lights.js'
import { add_poster_shadow_layers } from '@/3d/scenes/add-poster-shadow-layers.js'
import { add_poster_stroke_layers } from '@/3d/scenes/add-poster-stroke-layers.js'
import { create_poster_scene_settings } from '@/3d/scenes/create-poster-scene-settings.js'
import { create_poster_scene_update } from '@/3d/scenes/create-poster-scene-update.js'
import { export_poster_glb } from '@/3d/scenes/export-poster-glb.js'
import {
  FIT_HEIGHT,
  INITIAL_BREATHING_AMOUNT,
  INITIAL_BREATHING_SPEED,
  INITIAL_DRIFT_AMOUNT,
  INITIAL_DRIFT_SPEED,
  INITIAL_GROUP_GAP,
  INITIAL_GYRO_AMOUNT,
  INITIAL_ATMOSPHERE_COLOR,
  INITIAL_ATMOSPHERE_DENSITY,
  INITIAL_ATMOSPHERE_ENABLED,
  INITIAL_MOSAIC_OPACITY,
  INITIAL_MOSAIC_SPREAD,
  INITIAL_MOTION_ENABLED,
  INITIAL_SHADOW_OPACITY,
  INITIAL_SHADOW_SPREAD,
  INITIAL_TILT_AMOUNT,
  INITIAL_ZOOM,
  SCENE_BACKGROUND,
  SHADOW_Z_GAIN,
  STROKE_Z_OFFSET,
  VECTOR_LAYERS
} from '@/3d/scenes/poster-scene-config.js'

const create_reduced_motion_reader = () => {
  if (typeof window === 'undefined') return () => false
  const reduced_motion_query = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  )
  return () => reduced_motion_query.matches
}

/**
 * @param {{
 *   fog: THREE.FogExp2,
 *   state: object,
 *   mosaic_group_map: Map<string, THREE.Group>,
 *   mosaic_materials: { material: THREE.MeshBasicMaterial, base_opacity: number }[],
 *   shadow_entries: { group: THREE.Group, parallax_offset: number }[],
 *   shadow_group_map: Map<string, THREE.Group>,
 *   shadow_materials: { material: THREE.MeshBasicMaterial, base_opacity: number, loaded: boolean }[],
 *   stroke_entries: { group: THREE.Group, parallax_offset: number, child_id: string }[],
 *   stroke_group_map: Map<string, THREE.Group>,
 *   stroke_materials: { material: THREE.MeshBasicMaterial, base_opacity: number, loaded: boolean, period: number }[]
 * }} options
 */
const create_poster_scene_appliers = ({
  fog,
  state,
  mosaic_group_map,
  mosaic_materials,
  shadow_entries,
  shadow_group_map,
  shadow_materials,
  stroke_entries,
  stroke_group_map,
  stroke_materials
}) => ({
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
    for (const entry of stroke_entries)
      entry.group.position.z =
        entry.parallax_offset * state.shadow_spread * SHADOW_Z_GAIN -
        state.group_gap +
        STROKE_Z_OFFSET
  },
  apply_stroke_visibility() {
    for (const [child_id, group] of stroke_group_map)
      group.visible =
        state.stroke_visible && state.shadow_layer_visible[child_id]
  },
  apply_stroke_opacity() {
    for (const entry of stroke_materials)
      if (entry.loaded)
        entry.material.opacity =
          entry.base_opacity * (state.stroke_visible ? 1 : 0)
  },
  apply_atmosphere() {
    fog.color.set(state.atmosphere_color)
  }
})

/**
 * @param {object} options
 */
const load_poster_texture_layers = ({
  poster_svg,
  root,
  plane_w,
  plane_h,
  state,
  layer_groups,
  shadow_entries,
  shadow_group_map,
  shadow_materials,
  stroke_entries,
  stroke_group_map,
  stroke_materials,
  appliers
}) => {
  const shadow_texture_promises = add_poster_shadow_layers({
    poster_svg,
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

  const stroke_texture_promises = add_poster_stroke_layers({
    poster_svg,
    root,
    plane_w,
    plane_h,
    shadow_spread: state.shadow_spread,
    group_gap: state.group_gap,
    layer_groups,
    stroke_entries,
    stroke_group_map,
    stroke_materials
  })

  appliers.apply_stroke_visibility()
  appliers.apply_stroke_opacity()

  return { shadow_texture_promises, stroke_texture_promises }
}

/**
 * @param {{ x: number, y: number }} pointer
 */
const create_poster_scene_raycast = pointer => {
  /** @type {THREE.PerspectiveCamera | null} */
  let camera_ref = null
  const camera = { canvas_height: 1 }
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const z_plane = new THREE.Plane()
  const cursor_before = new THREE.Vector3()
  const cursor_after = new THREE.Vector3()

  return {
    camera,
    get_camera: () => camera_ref,
    mount_camera(camera) {
      camera_ref = camera || null
    },
    raycast: {
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
  }
}

/**
 * @param {string} svg_string
 * @returns {import('@/3d/engine/types.js').PosterSceneController}
 */
export const create_poster_scene = svg_string => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SCENE_BACKGROUND)
  const fog = new THREE.FogExp2(INITIAL_ATMOSPHERE_COLOR, 0)
  scene.fog = fog

  add_poster_scene_lights(scene)

  const root = new THREE.Group()
  scene.add(root)

  const poster_svg = parse_poster_svg(svg_string)
  const { width, height, layers } = parse_svg_layers_from_context(
    poster_svg,
    VECTOR_LAYERS.map(layer => layer.name)
  )

  // A zero or NaN height (empty/malformed poster SVG) would otherwise
  // divide out to an Infinity/NaN scale that propagates into every
  // downstream transform.
  const scale = FIT_HEIGHT / (height || 1)
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
    stroke_visible: true,
    group_gap: INITIAL_GROUP_GAP,
    tilt_amount: INITIAL_TILT_AMOUNT,
    gyro_amount: INITIAL_GYRO_AMOUNT,
    atmosphere_enabled: INITIAL_ATMOSPHERE_ENABLED,
    atmosphere_color: INITIAL_ATMOSPHERE_COLOR,
    atmosphere_density: INITIAL_ATMOSPHERE_DENSITY,
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
  const stroke_entries = []
  const stroke_group_map = new Map()
  const stroke_materials = []

  const appliers = create_poster_scene_appliers({
    fog,
    state,
    mosaic_group_map,
    mosaic_materials,
    shadow_entries,
    shadow_group_map,
    shadow_materials,
    stroke_entries,
    stroke_group_map,
    stroke_materials
  })

  appliers.apply_mosaic_spread()
  appliers.apply_mosaic_opacity()
  appliers.apply_mosaic_visibility()
  appliers.apply_atmosphere()

  const { shadow_texture_promises, stroke_texture_promises } =
    load_poster_texture_layers({
      poster_svg,
      root,
      plane_w,
      plane_h,
      state,
      layer_groups,
      shadow_entries,
      shadow_group_map,
      shadow_materials,
      stroke_entries,
      stroke_group_map,
      stroke_materials,
      appliers
    })

  const smooth = { x: 0, y: 0 }
  const pan = {
    target: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    prev: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
  }
  const zoom = { target: INITIAL_ZOOM, current: INITIAL_ZOOM }
  const tilt = { x: 0, y: 0 }
  const pointer = { x: 0, y: 0 }
  const get_reduced_motion = create_reduced_motion_reader()
  const { camera, get_camera, mount_camera, raycast } =
    create_poster_scene_raycast(pointer)

  const update = create_poster_scene_update({
    scene,
    root,
    layer_groups,
    plane_w,
    plane_h,
    get_camera,
    get_mosaic_spread: () => state.mosaic_spread,
    get_shadow_spread: () => state.shadow_spread,
    get_motion_enabled: () => state.motion_enabled,
    get_drift_amount: () => state.drift_amount,
    get_drift_speed: () => state.drift_speed,
    get_breathing_amount: () => state.breathing_amount,
    get_breathing_speed: () => state.breathing_speed,
    get_tilt_amount: () => state.tilt_amount,
    get_gyro_amount: () => state.gyro_amount,
    get_atmosphere_enabled: () => state.atmosphere_enabled,
    get_atmosphere_density: () => state.atmosphere_density,
    get_stroke_visible: () => state.stroke_visible,
    stroke_materials,
    appliers,
    smooth,
    pan,
    zoom,
    tilt,
    pointer,
    camera,
    raycast,
    get_reduced_motion
  })

  const settings = create_poster_scene_settings(state, appliers)

  return {
    scene,
    mount({ camera } = {}) {
      mount_camera(camera)
    },
    on_resize({ height } = {}) {
      if (height) camera.canvas_height = height
    },
    update,
    ...settings,
    async wait_for_textures() {
      await Promise.all([
        ...shadow_texture_promises,
        ...stroke_texture_promises
      ])
      appliers.apply_stroke_opacity()
    },
    export_glb(filename = 'poster') {
      export_poster_glb(scene, filename)
    },
    dispose() {
      scene.traverse(object => {
        object.geometry?.dispose()
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material].filter(Boolean)
        for (const material of materials) {
          for (const value of Object.values(material))
            if (value?.isTexture) value.dispose()
          material.dispose()
        }
      })
    }
  }
}
