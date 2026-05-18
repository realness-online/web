import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

const LIGHT_DIVISOR = Math.PI

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

    if (obj.geometry.attributes.color) {
      const geo = obj.geometry.clone()
      const colors = geo.attributes.color
      const normals = geo.attributes.normal
      const world_normal = new THREE.Vector3()

      for (let i = 0; i < colors.count; i++) {
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
            world_normal.dot(
              new THREE.Vector3().copy(light.position).normalize()
            )
          )
          lr += (light.color.r * light.intensity * dot) / LIGHT_DIVISOR
          lg += (light.color.g * light.intensity * dot) / LIGHT_DIVISOR
          lb += (light.color.b * light.intensity * dot) / LIGHT_DIVISOR
        }

        colors.setXYZ(
          i,
          Math.min(1, colors.getX(i) * lr),
          Math.min(1, colors.getY(i) * lg),
          Math.min(1, colors.getZ(i) * lb)
        )
      }

      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: src_mat.transparent,
          opacity: src_mat.opacity,
          depthWrite: src_mat.depthWrite
        })
      )
      mesh.name = obj.name
      mesh.applyMatrix4(obj.matrixWorld)
      mosaic_group.add(mesh)
    } else if (src_mat.map) {
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
