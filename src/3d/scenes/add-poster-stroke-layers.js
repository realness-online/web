import * as THREE from 'three'
import { extract_symbol_child_stroke_from_context } from '@/3d/utils/load-svg-layers.js'
import { svg_to_canvas_texture } from '@/3d/utils/load-svg-texture.js'
import {
  SHADOW_Z_GAIN,
  STROKE_BASE_WIDTH,
  STROKE_DASHARRAY,
  STROKE_LAYER_IDS,
  STROKE_PULSE_PERIODS,
  STROKE_Z_OFFSET,
  TEXTURE_LAYERS
} from '@/3d/scenes/poster-scene-config.js'

/**
 * @param {string} layer_svg
 * @param {{ dasharray?: string, stroke_width?: string }} options
 */
const prepare_stroke_layer_svg = (layer_svg, options = {}) => {
  const { dasharray, stroke_width = String(STROKE_BASE_WIDTH) } = options
  const doc = new DOMParser().parseFromString(layer_svg, 'image/svg+xml')
  const path = doc.querySelector('path')
  if (!path) return layer_svg

  if (dasharray) path.setAttribute('stroke-dasharray', dasharray)
  path.setAttribute('stroke-width', stroke_width)
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-miterlimit', '3.14')
  path.setAttribute('stroke-dashoffset', '0')

  return new XMLSerializer().serializeToString(doc.documentElement)
}

/**
 * @param {{
 *   poster_svg: import('@/3d/utils/load-svg-layers.js').PosterSvgContext,
 *   root: THREE.Group,
 *   plane_w: number,
 *   plane_h: number,
 *   shadow_spread: number,
 *   group_gap: number,
 *   layer_groups: object[],
 *   stroke_entries: { group: THREE.Group, parallax_offset: number, child_id: string }[],
 *   stroke_group_map: Map<string, THREE.Group>,
 *   stroke_materials: object[]
 * }} options
 * @returns {Promise<unknown>[]}
 */
export const add_poster_stroke_layers = options => {
  const {
    poster_svg,
    root,
    plane_w,
    plane_h,
    shadow_spread,
    group_gap,
    layer_groups,
    stroke_entries,
    stroke_group_map,
    stroke_materials
  } = options

  const texture_promises = []
  const stroke_layers = TEXTURE_LAYERS.filter(config =>
    STROKE_LAYER_IDS.includes(config.child_id)
  )

  for (const config of stroke_layers) {
    const layer_svg = extract_symbol_child_stroke_from_context(
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
    mesh.name = config.name.replace('shadow-', 'stroke-')

    const group = new THREE.Group()
    group.name = `stroke_${config.child_id}`
    group.position.z =
      config.parallax_offset * shadow_spread * SHADOW_Z_GAIN -
      group_gap +
      STROKE_Z_OFFSET
    group.add(mesh)
    root.add(group)
    layer_groups.push({ ...config, group, kind: 'stroke' })
    stroke_entries.push({
      group,
      parallax_offset: config.parallax_offset,
      child_id: config.child_id
    })
    stroke_group_map.set(config.child_id, group)

    const material_entry = {
      material,
      base_opacity: 1,
      loaded: false,
      period:
        STROKE_PULSE_PERIODS[config.child_id] ?? STROKE_PULSE_PERIODS.light
    }
    stroke_materials.push(material_entry)

    const raster_svg = prepare_stroke_layer_svg(layer_svg, {
      dasharray: STROKE_DASHARRAY[config.child_id]
    })

    const texture_promise = svg_to_canvas_texture(raster_svg)
      .then(({ texture }) => {
        material.map = texture
        material.needsUpdate = true
        material_entry.loaded = true
        material.opacity = material_entry.base_opacity
      })
      .catch(error => {
        console.error(`Failed to load ${config.name} stroke layer:`, error)
        throw error
      })
    texture_promises.push(texture_promise)
  }

  return texture_promises
}
