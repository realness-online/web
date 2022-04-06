<template>
  <defs itemprop="effects">
    <g class="gradients">
      <linearGradient
        :id="query('height-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0%"
        x2="0"
        y1="0"
        y2="100%">
        <stop
          v-for="stop in height"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
      <linearGradient
        :id="query('width-gradient')"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="100%"
        y1="0"
        y2="0">
        <stop
          v-for="stop in width"
          :stop-color="stop.color.hsla"
          :offset="`${stop.percentage}%`" />
      </linearGradient>
    </g>
    <g class="filters">
      <filter :id="query('background-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0.21 0
                  0 1 0 0.21 0
                  0 0 1 0.21 0
                  0 0 0 2.00 0" />
      </filter>
      <filter :id="query('light-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 -0.11 0
                  0 1 0 -0.11 0
                  0 0 1 -0.11 0
                  0 0 0 2.0 0" />
      </filter>
      <filter :id="query('regular-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 -0.5 0
                  0 1 0 -0.5 0
                  0 0 1 -0.5 0
                  0 0 0  1.4 0" />
      </filter>
      <filter :id="query('bold-filter')">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 -0.88 0
                  0 1 0 -0.88 0
                  0 0 1 -0.88 0
                  0 0 0  2.50 0" />
      </filter>
    </g>
  </defs>
</template>
<script setup>
  import { ref, watchEffect as watch_effect } from 'vue'
  import { is_vector, use_poster } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const { query } = use_poster({ poster: props.vector })
  const { new_gradients: gradients } = use_vectorize()
  const width = ref([])
  const height = ref([])
  watch_effect(() => {
    if (!gradients.value) return
    width.value = gradients.value.width
    height.value = gradients.value.height
  })
</script>
