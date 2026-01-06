/** @typedef {import('@/types').Poster} PosterType */
import { ref, nextTick as tick, onUnmounted as dismount } from 'vue'
import get_item from '@/utils/item'
import { as_query_id } from '@/utils/itemid'

export const use = (vector, on_complete) => {
  const optimizer = ref(null)
  const optimize = () => {
    if (optimizer.value) optimizer.value.terminate()
    optimizer.value = new Worker('/vector.worker.js')
    optimizer.value.addEventListener('message', optimized)
    tick().then(() => {
      const element = document.getElementById(as_query_id(vector.value.id))
      optimizer.value.postMessage({
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
    optimizer.value.removeEventListener('message', optimized)

    if (on_complete) on_complete()
  }
  dismount(() => {
    if (optimizer.value) optimizer.value.terminate()
  })
  return {
    optimize,
    vector
  }
}
