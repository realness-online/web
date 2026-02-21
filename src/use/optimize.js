/** @typedef {import('@/types').Poster} PosterType */
import { ref, nextTick as tick, onUnmounted as dismount } from 'vue'
import get_item from '@/utils/item'
import { as_query_id } from '@/utils/itemid'

export const use = (vector, on_complete) => {
  const optimizer = ref(/** @type {Worker | null} */ (null))
  const optimize = () => {
    if (optimizer.value) optimizer.value.terminate()
    optimizer.value = new Worker('/vector.worker.js')
    const worker = optimizer.value
    if (!worker) return
    worker.addEventListener('message', optimized)
    tick().then(() => {
      const element = document.getElementById(as_query_id(vector.value.id))
      if (!element) return
      worker.postMessage({
        route: 'optimize:vector',
        vector: element.outerHTML
      })
    })
  }
  const optimized = message => {
    const optimized_item = /** @type {PosterType} */ (
      /** @type {unknown} */ (get_item(message.data.vector, vector.value.id))
    )
    if (optimized_item) {
      const poster = /** @type {PosterType} */ (vector.value)
      poster.light = optimized_item.light
      poster.regular = optimized_item.regular
      poster.medium = optimized_item.medium
      poster.bold = optimized_item.bold
      poster.cutout = optimized_item.cutout
      poster.optimized = true
    }
    if (optimizer.value)
      optimizer.value.removeEventListener('message', optimized)

    if (on_complete) on_complete()
  }
  dismount(() => {
    const worker = optimizer.value
    if (worker) worker.terminate()
  })
  return {
    optimize,
    vector
  }
}
