import * as THREE from 'three'
import { describe, it, expect } from 'vite-plus/test'
import { add_poster_scene_lights } from '@/3d/scenes/add-poster-scene-lights.js'

describe('add_poster_scene_lights', () => {
  it('adds ambient and two directional lights', () => {
    const scene = new THREE.Scene()
    add_poster_scene_lights(scene)

    const types = scene.children.map(child => child.type)
    expect(types).toContain('AmbientLight')
    expect(types.filter(type => type === 'DirectionalLight').length).toBe(2)
  })
})
