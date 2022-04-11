<template>
  <defs itemprop="filters">
    <filter :id="query('background-filter')">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>
    <filter :id="query('light-filter')">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>
    <filter :id="query('regular-filter')">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>
    <filter :id="query('bold-filter')">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 2.75 0" />
    </filter>
  </defs>
</template>
<script setup>
  import { ref, watchEffect as watch_effect, computed } from 'vue'
  import { is_vector, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { color_to_hsla } from '@/use/colors'
  const { new_gradients: gradients, new_vector } = use_vectorize()
  const { query, vector } = use_poster()
  const background = computed(() => {
    if (radial.value) {
      return radial.value.map(stop => {
        if (stop.color.l > 85) return stop
        else {
          console.log('stop.color', stop.color)
          const color = color_to_hsla({
            h: stop.color.h,
            s: stop.color.s,
            l: 35,
            a: stop.color.a
          })
          return {
            color,
            percentage: stop.percentage
          }
        }
      })
    } else return []
  })
  vector.value = new_vector.value
  const width = ref([])
  const height = ref([])
  const radial = ref([])
  watch_effect(() => {
    if (!gradients.value) return
    width.value = gradients.value.width
    height.value = gradients.value.height
    radial.value = gradients.value.radial
  })
</script>
