import { ref, nextTick as next_tick, onUnmounted as dismount } from 'vue'

import get_item from '@/use/item'
import { as_query_id } from '@/use/itemid'
export const use = vector => {
  const optimizer = ref(null)
  const compressor = ref(null)
  const optimize = async () => {
    await next_tick()
    optimizer.value = new Worker('/optimize.worker.js')
    compressor.value = new Worker('/compressor.worker.js')
    optimizer.value.addEventListener('message', optimized)
    const element = document.getElementById(as_query_id(vector.value.id))
    optimizer.value.postMessage({ vector: element.outerHTML })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    vector.value.light = optimized.light
    vector.value.regular = optimized.regular
    vector.value.medium = optimized.medium
    vector.value.bold = optimized.bold
    vector.value.optimized = true
    optimizer.value.removeEventListener('message', optimized)
    next_tick().then(() => {
      const element = document.getElementById(as_query_id(vector.value.id))
      compressor.value.postMessage({ vector: element.outerHTML })
    })
  }
  dismount(() => {
    if (optimizer.value) optimizer.value.terminate()
    if (compressor.value) compressor.value.terminate()
  })
  return {
    optimize,
    vector
  }
}
