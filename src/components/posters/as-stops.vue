<template>
  <stop
    v-for="stop in converted"
    :key="stop.offset"
    :stop-color="stop.color.hsla"
    :offset="`${stop.offset}%`" />
</template>
<script setup>
  import { computed } from 'vue'
  import { color_to_hsla } from '@/use/colors'
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
