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
    },
    saturation_floor: {
      type: Number,
      required: false
    }
  })
  const converted = computed(() => {
    return props.stops.map(stop => {
      let saturation = props.saturation_floor
      if (saturation && stop.color.s < saturation) {
        // leave things bee
      } else saturation = stop.color.s
      return {
        offset: stop.offset,
        color: color_to_hsla({
          h: stop.color.h,
          s: saturation,
          l: props.luminosity,
          a: 1
        })
      }
    })
  })
</script>
