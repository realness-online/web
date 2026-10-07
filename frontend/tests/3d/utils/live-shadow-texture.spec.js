import * as THREE from 'three'
import { describe, it, expect, afterEach } from 'vite-plus/test'
import {
  reset_html_in_canvas_probe,
  probe_html_in_canvas
} from '@/3d/utils/html-in-canvas.js'
import {
  create_live_texture_capture,
  attach_live_poster_texture
} from '@/3d/utils/live-shadow-texture.js'

describe('html-in-canvas probe', () => {
  afterEach(() => {
    reset_html_in_canvas_probe()
  })

  it('reports unsupported where there is no webgl context (every non-flag browser)', () => {
    expect(probe_html_in_canvas()).toBe(false)
  })
})

describe('live-shadow-texture fallback', () => {
  it('capture is null without the feature, so the caller keeps its baked texture', () => {
    const element = document.createElement('div')
    expect(create_live_texture_capture({ element })).toBeNull()
  })

  it('attach returns null without the feature and leaves the shadow material alone', () => {
    const scene = new THREE.Scene()
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    mesh.name = 'shadow-bold'
    scene.add(mesh)

    const release = attach_live_poster_texture({
      element: document.createElement('div'),
      scene
    })

    expect(release).toBeNull()
    expect(material.map).toBeNull()
  })
})
