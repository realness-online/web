import * as THREE from 'three'
import { extract_symbol_child_svg } from '../utils/load-svg-layers.js'
import { svg_to_canvas_texture } from '../utils/load-svg-texture.js'
import { SHADOW_Z_GAIN, TEXTURE_LAYERS } from './poster-scene-config.js'

/**
 * @param {{
 *   svg_string: string,
 *   root: THREE.Group,
 *   plane_w: number,
 *   plane_h: number,
 *   shadow_spread: number,
 *   group_gap: number,
 *   shadow_opacity: number,
 *   layer_groups: object[],
 *   shadow_entries: { group: THREE.Group, parallax_offset: number }[],
 *   shadow_group_map: Map<string, THREE.Group>,
 *   shadow_materials: { material: THREE.MeshBasicMaterial, base_opacity: number, loaded: boolean }[],
 *   shadow_layer_visible: Record<string, boolean>
 * }} options
 * @returns {Promise<unknown>[]}
 */
export const add_poster_shadow_layers = options => {
  const {
    svg_string,
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
    const layer_svg = extract_symbol_child_svg(
      svg_string,
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
    const material_entry = { material, base_opacity: 1, loaded: false }
    shadow_materials.push(material_entry)

    const texture_promise = svg_to_canvas_texture(layer_svg)
      .then(({ texture }) => {
        material.map = texture
        material.needsUpdate = true
        material_entry.loaded = true
        material.opacity = material_entry.base_opacity * shadow_opacity
      })
      .catch(error =>
        console.error(`Failed to load ${config.name} layer:`, error)
      )
    texture_promises.push(texture_promise)
  }

  return texture_promises
}
