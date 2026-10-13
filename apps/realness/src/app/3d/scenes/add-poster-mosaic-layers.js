import * as THREE from 'three'
import { build_poster_layer_geometry } from '@/3d/scenes/build-poster-layer-geometry.js'
import { VECTOR_LAYERS } from '@/3d/scenes/poster-scene-config.js'

/**
 * @param {{
 *   root: THREE.Group,
 *   layers: { name: string, paths: import('three').ShapePath[] }[],
 *   width: number,
 *   height: number,
 *   scale: number,
 *   layer_groups: object[],
 *   mosaic_group_map: Map<string, THREE.Group>,
 *   mosaic_materials: { material: THREE.MeshBasicMaterial, base_opacity: number }[],
 *   mosaic_layer_visible: Record<string, boolean>
 * }} options
 */
export const add_poster_mosaic_layers = options => {
  const {
    root,
    layers,
    width,
    height,
    scale,
    layer_groups,
    mosaic_group_map,
    mosaic_materials,
    mosaic_layer_visible
  } = options

  for (const config of VECTOR_LAYERS) {
    const layer_data = layers.find(layer => layer.name === config.name)
    if (!layer_data) continue

    const geometry = build_poster_layer_geometry(layer_data.paths)
    if (!geometry) continue

    geometry.translate(-width / 2, -height / 2, 0)
    geometry.scale(scale, -scale, 1)

    const base_opacity = config.opacity ?? 1
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: base_opacity,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = config.name

    const group = new THREE.Group()
    group.name = `mosaic_${config.name}`
    group.add(mesh)
    root.add(group)
    layer_groups.push({ ...config, group, kind: 'mosaic' })
    mosaic_group_map.set(config.name, group)
    mosaic_layer_visible[config.name] = true
    mosaic_materials.push({ material, base_opacity })
  }
}
