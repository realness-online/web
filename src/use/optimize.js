/** @typedef {import('@/types').Poster} Poster */
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
    const optimized_item = get_item(message.data.vector, vector.value.id)
    if (optimized_item) {
      vector.value.light = optimized_item.light
      vector.value.regular = optimized_item.regular
      vector.value.medium = optimized_item.medium
      vector.value.bold = optimized_item.bold
      vector.value.cutout = optimized_item.cutout
      vector.value.optimized = true
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
