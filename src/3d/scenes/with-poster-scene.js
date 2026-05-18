/** @typedef {import('@/3d/engine/types.js').PosterSceneController} PosterSceneController */

/**
 * Mounts a headless poster scene, runs async work, then disposes WebGL.
 *
 * @param {string} svg_string
 * @param {(scene: PosterSceneController) => Promise<void>} fn
 */
export const with_poster_scene = async (svg_string, fn) => {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'none'
  document.body.appendChild(canvas)

  const { create_app } = await import('@/3d/engine/create-app.js')
  const { create_poster_scene } =
    await import('@/3d/scenes/create-poster-scene.js')
  const app = create_app({ canvas })
  const scene = create_poster_scene(svg_string)
  app.mount_scene(scene)
  app.start()

  try {
    await fn(scene)
  } finally {
    app.stop()
    app.get_renderer().dispose()
    document.body.removeChild(canvas)
  }
}
