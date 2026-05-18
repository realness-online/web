import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const DEFAULT_PATH_COLOR = 0x000000
const COLOR_COMPONENTS = 3

/**
 * @param {THREE.ShapePath[]} paths
 * @returns {THREE.BufferGeometry | null}
 */
export const build_poster_layer_geometry = paths => {
  const geometries = []

  for (const shape_path of paths) {
    const color = shape_path.color || new THREE.Color(DEFAULT_PATH_COLOR)
    const shapes = SVGLoader.createShapes(shape_path)
    for (const shape of shapes) {
      const geometry = new THREE.ShapeGeometry(shape)
      const { count } = geometry.attributes.position
      const colors = new Float32Array(count * COLOR_COMPONENTS)
      for (let i = 0; i < count; i++) {
        colors[i * COLOR_COMPONENTS] = color.r
        colors[i * COLOR_COMPONENTS + 1] = color.g
        colors[i * COLOR_COMPONENTS + 2] = color.b
      }
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, COLOR_COMPONENTS)
      )
      geometries.push(geometry)
    }
  }

  if (!geometries.length) return null
  return mergeGeometries(geometries, false)
}
