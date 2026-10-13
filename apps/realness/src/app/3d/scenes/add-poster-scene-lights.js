import * as THREE from 'three'
import {
  AMBIENT_LIGHT_COLOR,
  AMBIENT_LIGHT_INTENSITY,
  FILL_LIGHT_COLOR,
  FILL_LIGHT_INTENSITY,
  FILL_LIGHT_Y,
  FILL_LIGHT_Z,
  KEY_LIGHT_COLOR,
  KEY_LIGHT_INTENSITY,
  KEY_LIGHT_Y,
  KEY_LIGHT_Z
} from '@/3d/scenes/poster-scene-config.js'

/**
 * @param {THREE.Scene} scene
 */
export const add_poster_scene_lights = scene => {
  const ambient = new THREE.AmbientLight(
    AMBIENT_LIGHT_COLOR,
    AMBIENT_LIGHT_INTENSITY
  )
  scene.add(ambient)

  const key_light = new THREE.DirectionalLight(
    KEY_LIGHT_COLOR,
    KEY_LIGHT_INTENSITY
  )
  key_light.position.set(0, KEY_LIGHT_Y, KEY_LIGHT_Z)
  scene.add(key_light)

  const fill_light = new THREE.DirectionalLight(
    FILL_LIGHT_COLOR,
    FILL_LIGHT_INTENSITY
  )
  fill_light.position.set(0, FILL_LIGHT_Y, FILL_LIGHT_Z)
  scene.add(fill_light)
}
