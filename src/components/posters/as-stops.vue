<script setup>
  import { computed } from 'vue'
  import { color_to_hsla } from '@/utils/colors'
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
  const converted = computed(() =>
    props.stops.map(stop => {
      let saturation = props.saturation_floor
      if (saturation && stop.color.s < saturation) {
        // leave things bee
      } else saturation = stop.color.s

      const color = color_to_hsla({
        h: stop.color.h,
        s: saturation,
        l: props.luminosity,
        a: 1
      })
      return {
        offset: stop.offset,
        color
      }
    })
  )
</script>

<template>
  <stop
    v-for="stop in converted"
    :key="stop.offset"
    :stop-color="stop.color.hsla"
    :offset="`${stop.offset}%`" />
</template>
