import {
  ref,
  onMounted as mounted,
  onUnmounted as dismount,
  nextTick as next_tick
} from 'vue'
import get_item from '@/use/item'
import { as_query_id } from '@/use/itemid'
export const use = vector => {
  const optimizer = ref(null)
  const optimize = async () => {
    await next_tick()
    optimizer.value = new Worker('/optimize.worker.js')
    optimizer.value.addEventListener('message', optimized)
    const element = document.getElementById(as_query_id(vector.value.id))
    optimizer.value.postMessage({ vector: element.outerHTML })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    vector.value = optimized
    vector.value.optimized = true
    optimizer.value.removeEventListener('message', optimized)
    optimizer.value.terminate()
  }
  return {
    optimize,
    vector
  }
}
