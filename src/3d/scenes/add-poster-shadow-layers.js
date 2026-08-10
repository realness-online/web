import * as THREE from 'three'
import {
  extract_symbol_child_fill_from_context,
  extract_symbol_child_mask_from_context,
  extract_symbol_child_paint_from_context
} from '@/3d/utils/load-svg-layers.js'
import { svg_to_canvas_texture } from '@/3d/utils/load-svg-texture.js'
import {
  GRADIENT_TEXTURE_SIZE,
  SHADOW_PULSE_KEYFRAMES,
  SHADOW_Z_GAIN,
  TEXTURE_LAYERS
} from '@/3d/scenes/poster-scene-config.js'

/**
 * Splits a gradient-filled layer into a slideable paint texture and a fixed
 * shape mask, so the colour can drift without dragging the shape with it.
 * Falls back to one baked texture for anything not gradient-filled.
 *
 * @param {{
 *   poster_svg: import('@/3d/utils/load-svg-layers.js').PosterSvgContext,
 *   config: { symbol_id: string, child_id: string },
 *   fill_svg: string,
 *   material: THREE.MeshBasicMaterial,
 *   entry: import('@/3d/engine/types.js').ShadowMaterialEntry
 * }} options
 */
const load_shadow_layer_texture = async ({
  poster_svg,
  config,
  fill_svg,
  material,
  entry
}) => {
  const { symbol_id, child_id } = config
  const paint_svg = extract_symbol_child_paint_from_context(
    poster_svg,
    symbol_id,
    child_id
  )
  const mask_svg =
    paint_svg &&
    extract_symbol_child_mask_from_context(poster_svg, symbol_id, child_id)

  if (!paint_svg || !mask_svg) {
    const { texture } = await svg_to_canvas_texture(fill_svg)
    material.map = texture
    return
  }

  const [paint, mask] = await Promise.all([
    svg_to_canvas_texture(paint_svg, { max_dimension: GRADIENT_TEXTURE_SIZE }),
    svg_to_canvas_texture(mask_svg, {
      background: '#000',
      color_space: THREE.NoColorSpace
    })
  ])

  paint.texture.wrapS = THREE.MirroredRepeatWrapping
  paint.texture.wrapT = THREE.MirroredRepeatWrapping
  material.map = paint.texture
  material.alphaMap = mask.texture
  entry.drift = paint.texture.offset
}

/**
 * @param {{
 *   poster_svg: import('@/3d/utils/load-svg-layers.js').PosterSvgContext,
 *   root: THREE.Group,
 *   plane_w: number,
 *   plane_h: number,
 *   shadow_spread: number,
 *   group_gap: number,
 *   shadow_opacity: number,
 *   layer_groups: object[],
 *   shadow_entries: { group: THREE.Group, parallax_offset: number }[],
 *   shadow_group_map: Map<string, THREE.Group>,
 *   shadow_materials: import('@/3d/engine/types.js').ShadowMaterialEntry[],
 *   shadow_layer_visible: Record<string, boolean>
 * }} options
 * @returns {Promise<unknown>[]}
 */
export const add_poster_shadow_layers = options => {
  const {
    poster_svg,
    root,
    plane_w,
    plane_h,
    shadow_spread,
    group_gap,
    shadow_opacity,
    layer_groups,
    shadow_entries,
    shadow_group_map,
    shadow_materials,
    shadow_layer_visible
  } = options

  const texture_promises = []

  for (const config of TEXTURE_LAYERS) {
    const layer_svg = extract_symbol_child_fill_from_context(
      poster_svg,
      config.symbol_id,
      config.child_id
    )
    if (!layer_svg) continue

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0
    })
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(plane_w, plane_h),
      material
    )
    mesh.name = config.name

    const group = new THREE.Group()
    group.name = `shadow_${config.name}`
    group.position.z =
      config.parallax_offset * shadow_spread * SHADOW_Z_GAIN - group_gap
    group.add(mesh)
    root.add(group)
    layer_groups.push({ ...config, group, kind: 'shadow' })
    shadow_entries.push({ group, parallax_offset: config.parallax_offset })
    shadow_group_map.set(config.child_id, group)
    shadow_layer_visible[config.child_id] = true
    const material_entry = {
      material,
      base_opacity: 1,
      loaded: false,
      pulse: SHADOW_PULSE_KEYFRAMES[config.child_id] ?? null,
      drift: null
    }
    shadow_materials.push(material_entry)

    const texture_promise = load_shadow_layer_texture({
      poster_svg,
      config,
      fill_svg: layer_svg,
      material,
      entry: material_entry
    })
      .then(() => {
        material.needsUpdate = true
        material_entry.loaded = true
        material.opacity = material_entry.base_opacity * shadow_opacity
      })
      .catch(error => {
        console.error(`Failed to load ${config.name} layer:`, error)
        throw error
      })
    texture_promises.push(texture_promise)
  }

  return texture_promises
}
