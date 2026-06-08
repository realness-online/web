import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

const LIGHT_DIVISOR = Math.PI
const BYTE_MAX = 255
const TEXEL_CENTER = 0.5
const RGBA_STRIDE = 4

/**
 * Bakes the scene lighting into a flat color per vertex, then packs those
 * colors into a tiny palette baseColorTexture. Vertex colors (COLOR_0) are
 * dropped by Apple's glTF pipeline (Preview, iPad), which left the mosaic
 * rendering as its white baseColorFactor. A texture is honored everywhere.
 *
 * @param {THREE.Mesh} obj
 * @param {THREE.Color} ambient_total
 * @param {THREE.DirectionalLight[]} dir_lights
 * @returns {THREE.Mesh}
 */
const build_mosaic_mesh = (obj, ambient_total, dir_lights) => {
  const src_mat = obj.material
  const geo = obj.geometry.clone()
  const colors = geo.attributes.color
  const normals = geo.attributes.normal
  const { count } = colors
  const world_normal = new THREE.Vector3()
  const scratch = new THREE.Color()
  const uvs = new Float32Array(count * 2)
  const vertex_index = new Uint32Array(count)
  const palette = []
  const palette_lookup = new Map()

  for (let i = 0; i < count; i++) {
    world_normal.set(0, 0, 1)
    if (normals)
      world_normal
        .fromBufferAttribute(normals, i)
        .transformDirection(obj.matrixWorld)

    let lr = ambient_total.r / LIGHT_DIVISOR
    let lg = ambient_total.g / LIGHT_DIVISOR
    let lb = ambient_total.b / LIGHT_DIVISOR
    for (const light of dir_lights) {
      const dot = Math.max(
        0,
        world_normal.dot(new THREE.Vector3().copy(light.position).normalize())
      )
      lr += (light.color.r * light.intensity * dot) / LIGHT_DIVISOR
      lg += (light.color.g * light.intensity * dot) / LIGHT_DIVISOR
      lb += (light.color.b * light.intensity * dot) / LIGHT_DIVISOR
    }

    scratch.setRGB(
      Math.min(1, colors.getX(i) * lr),
      Math.min(1, colors.getY(i) * lg),
      Math.min(1, colors.getZ(i) * lb)
    )
    scratch.convertLinearToSRGB()
    const r8 = Math.round(scratch.r * BYTE_MAX)
    const g8 = Math.round(scratch.g * BYTE_MAX)
    const b8 = Math.round(scratch.b * BYTE_MAX)
    const key = `${r8},${g8},${b8}`
    let idx = palette_lookup.get(key)
    if (idx === undefined) {
      idx = palette.length
      palette_lookup.set(key, idx)
      palette.push([r8, g8, b8])
    }
    vertex_index[i] = idx
  }

  const palette_size = palette.length
  for (let i = 0; i < count; i++) {
    uvs[i * 2] = (vertex_index[i] + TEXEL_CENTER) / palette_size
    uvs[i * 2 + 1] = TEXEL_CENTER
  }

  const data = new Uint8Array(palette_size * RGBA_STRIDE)
  for (let k = 0; k < palette_size; k++) {
    const [r8, g8, b8] = palette[k]
    data[k * RGBA_STRIDE] = r8
    data[k * RGBA_STRIDE + 1] = g8
    data[k * RGBA_STRIDE + 2] = b8
    data[k * RGBA_STRIDE + 3] = BYTE_MAX
  }

  const texture = new THREE.DataTexture(data, palette_size, 1, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  geo.deleteAttribute('color')
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: src_mat.transparent,
      opacity: src_mat.opacity,
      depthWrite: src_mat.depthWrite
    })
  )
  mesh.name = obj.name
  mesh.applyMatrix4(obj.matrixWorld)
  return mesh
}

/**
 * @param {THREE.Scene} scene
 * @param {string} [filename]
 */
export const export_poster_glb = (scene, filename = 'poster') => {
  const exporter = new GLTFExporter()
  const export_scene = new THREE.Scene()
  const mosaic_group = new THREE.Group()
  mosaic_group.name = 'mosaic'
  const shadow_group = new THREE.Group()
  shadow_group.name = 'shadows'
  export_scene.add(mosaic_group)
  export_scene.add(shadow_group)

  const ambient_total = new THREE.Color(0, 0, 0)
  const dir_lights = []
  scene.traverse(obj => {
    if (obj.isAmbientLight) {
      ambient_total.r += obj.color.r * obj.intensity
      ambient_total.g += obj.color.g * obj.intensity
      ambient_total.b += obj.color.b * obj.intensity
    }
    if (obj.isDirectionalLight) dir_lights.push(obj)
  })

  scene.traverse(obj => {
    if (!obj.isMesh) return
    obj.updateWorldMatrix(true, false)
    const src_mat = obj.material

    if (obj.geometry.attributes.color)
      mosaic_group.add(build_mosaic_mesh(obj, ambient_total, dir_lights))
    else if (src_mat.map) {
      const mesh = new THREE.Mesh(
        obj.geometry.clone(),
        new THREE.MeshBasicMaterial({
          map: src_mat.map,
          transparent: src_mat.transparent,
          opacity: src_mat.opacity,
          depthWrite: src_mat.depthWrite
        })
      )
      mesh.name = obj.name
      mesh.applyMatrix4(obj.matrixWorld)
      shadow_group.add(mesh)
    }
  })

  exporter.parse(
    export_scene,
    buffer => {
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.glb`
      a.click()
      URL.revokeObjectURL(url)
    },
    error => console.error('GLTFExporter error:', error),
    { binary: true }
  )
}
