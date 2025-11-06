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
    const optimized = get_item(message.data.vector)
    vector.value.light = optimized.light
    vector.value.regular = optimized.regular
    vector.value.medium = optimized.medium
    vector.value.bold = optimized.bold
    vector.value.cutout = optimized.cutout
    vector.value.optimized = true
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
