/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/3d/engine/types.js').PosterSceneController} PosterSceneController */

/** @type {Map<string, PosterSceneController>} */
const live_scenes = new Map()

/**
 * @param {Id} itemid
 * @param {PosterSceneController} scene
 * @returns {() => void}
 */
export const register_live_poster_scene = (itemid, scene) => {
  live_scenes.set(itemid, scene)
  return () => {
    if (live_scenes.get(itemid) === scene) live_scenes.delete(itemid)
  }
}

/**
 * @param {Id} itemid
 * @returns {PosterSceneController | undefined}
 */
export const get_live_poster_scene = itemid => live_scenes.get(itemid)
