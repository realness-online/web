import { ref, nextTick as next_tick, onUnmounted as dismount } from 'vue'
import get_item from '@/utils/item'
import { as_query_id } from '@/utils/itemid'

/** @type {import('vue').Ref<Worker | null>} */
const optimizer = ref(null)

/**
 * @param {import('vue').Ref<Vector>} vector
 * @returns {Object}
 */
export const use = vector => {
   const optimize = async () => {
    optimizer.value = new Worker('/vector.worker.js')
    optimizer.value.addEventListener('message', optimized)
    await next_tick()
    const element = document.getElementById(as_query_id(vector.value.id))
    if (!element) return
    optimizer.value?.postMessage({
      route: 'optimize:vector',
      vector: element.outerHTML
    })
  }

  /** @param {MessageEvent} message */
  const optimized = message => {
    /** @type {import('@/use/vector').Vector} */
    const optimized = get_item(message.data.vector)
    if (!optimized) return
    vector.value.light = optimized.light
    vector.value.regular = optimized.regular
    vector.value.medium = optimized.medium
    vector.value.bold = optimized.bold
    vector.value.optimized = true
    optimizer.value?.removeEventListener('message', optimized)
  }
  dismount(() => {
    if (optimizer.value) optimizer.value.terminate()
  })
  return {
    optimize,
    vector
  }
}
