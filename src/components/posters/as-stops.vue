<template>
  <stop
    v-for="stop in converted"
    :key="stop.offset"
    :stop-color="stop.color.hsla"
    :offset="`${stop.offset}%`" />
</template>
<script setup>
  import { ref, watchEffect as watch_effect, computed } from 'vue'
  import { is_vector_id, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { color_to_hsla, hsla_to_color } from '@/use/colors'
  const { new_gradients: gradients, new_vector } = use_vectorize()
  const is_stops = stops => {
    if (!Array.isArray(stops)) return false
    if (stops.length < 1) return false
    return true
  }
  const props = defineProps({
    luminosity: {
      type: Number,
      required: true
    },
    stops: {
      type: Array,
      required: true
    }
  })
  const converted = computed(() => {
    return props.stops.map(stop => {
      return {
        offset: stop.offset,
        color: color_to_hsla({
          h: stop.color.h,
          s: stop.color.s,
          l: props.luminosity,
          a: 1
        })
      }
    })
  })
</script>
