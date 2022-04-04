<template>
  <filter id="background-filter" color-interpolation-filters="sRGB"></filter>
  <filter id="light-filter" x="0" y="0" width="100%" height="100%"></filter>
  <filter id="regular-filter" x="0" y="0" width="100%" height="100%"></filter>
  <filter id="bold-filter" x="0" y="0" width="100%" height="100%"></filter>
  <linearGradient
    gradientUnits="userSpaceOnUse"
    id="height-gradient"
    x1="0%"
    x2="0"
    y1="0"
    y2="100%">
    <stop
      v-for="stop in height"
      :stop-color="stop.color"
      :offset="`${stop.percentage}%`" />
  </linearGradient>
  <linearGradient
    id="width-gradient"
    gradientUnits="userSpaceOnUse"
    x1="0"
    x2="100%"
    y1="0"
    y2="0">
    <stop
      v-for="stop in width"
      :stop-color="stop.color"
      :offset="`${stop.percentage}%`" />
  </linearGradient>
  <filter id="emboss">
    <feConvolveMatrix
      kernelMatrix="3 0 0
                    0 0 0
                    0 0 -3" />
  </filter>
</template>
<script setup>
  import { ref } from 'vue'
  import { is_vector } from '@/use/vector'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const height = ref(props.vector.gradients?.height)
  const width = ref(props.vector.gradients?.width)
</script>
