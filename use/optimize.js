import { ref, nextTick as next_tick, onUnmounted as dismount } from 'vue'

import get_item from '@/use/item'
import { as_query_id } from '@/use/itemid'
export const use = vector => {
  const optimizer = ref(null)
  const compressor = ref(null)
  const optimize = () => {
    optimizer.value = new Worker('/optimize.worker.js')
    compressor.value = new Worker('/compressor.worker.js')
    optimizer.value.addEventListener('message', optimized)
    next_tick().then(() => {
      const element = document.getElementById(as_query_id(vector.value.id))
      optimizer.value.postMessage({ vector: element.outerHTML })
    })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    console.log('optimized', optimized)
    vector.value.light = get_path(optimized.light)
    vector.value.regular = get_path(optimized.regular)
    vector.value.medium = get_path(optimized.medium)
    vector.value.bold = get_path(optimized.bold)
    vector.value.optimized = true
    console.log('vector', vector.value)
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

const get_path = path => (Array.isArray(path) ? path[0] : path)
