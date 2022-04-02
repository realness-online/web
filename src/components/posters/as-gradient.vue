<template>
  <linearGradient
    v-if="height"
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
    v-if="width"
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
</template>
<script setup>
  import { ref } from 'vue'
  import { is_vector } from '@/use/vector'
  const props = defineProps({
    poster: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const height = ref(props.poster?.gradients?.height)
  const width = ref(props.poster?.gradients?.width)
</script>
