import { ref, onMounted as mounted, onUnmounted as dismount } from 'vue'
import get_item from '@/use/item'

export const use = () => {
  const vector = ref(null)
  const optimizer = ref(null)
  const optimize = vector => {
    console.log('calling optmize', vector)
    optimizer.value.postMessage({ vector })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    vector.value = optimized
  }
  mounted(() => {
    console.log('mount optimizer')
    optimizer.value = new Worker('/optimize.worker.js')
    optimizer.value.addEventListener('message', optimized)
  })
  dismount(() => {
    optimizer.value.terminate()
    console.log('terminate optimizer')
  })
  return {
    optimize,
    vector
  }
}
