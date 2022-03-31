<template>
  <defs itemprop="effects">
    <filter id="background-filter" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR
          type="table"
          tableValues="0.0000 0.0059 0.0166 0.0346 0.0628 0.1038 0.1586 0.2259 0.3011 0.3761 0.4406 0.4844 0.5000 0.5156 0.5594 0.6239 0.6989 0.7741 0.8414 0.8962 0.9372 0.9654 0.9834 0.9941 1.0000" />
        <feFuncG
          type="table"
          tableValues="0.0000 0.0059 0.0166 0.0346 0.0628 0.1038 0.1586 0.2259 0.3011 0.3761 0.4406 0.4844 0.5000 0.5156 0.5594 0.6239 0.6989 0.7741 0.8414 0.8962 0.9372 0.9654 0.9834 0.9941 1.0000" />
        <feFuncB
          type="table"
          tableValues="0.0000 0.0059 0.0166 0.0346 0.0628 0.1038 0.1586 0.2259 0.3011 0.3761 0.4406 0.4844 0.5000 0.5156 0.5594 0.6239 0.6989 0.7741 0.8414 0.8962 0.9372 0.9654 0.9834 0.9941 1.0000" />
        <feFuncA
          type="table"
          tableValues="0.0000 0.0059 0.0166 0.0346 0.0628 0.1038 0.1586 0.2259 0.3011 0.3761 0.4406 0.4844 0.5000 0.5156 0.5594 0.6239 0.6989 0.7741 0.8414 0.8962 0.9372 0.9654 0.9834 0.9941 1.0000" />
      </feComponentTransfer>
    </filter>

    <filter id="light-filter" x="0" y="0" width="100%" height="100%">
      <feComponentTransfer>
        <feFuncR type="gamma" exponent="1" />
        <feFuncG type="gamma" exponent="1" />
        <feFuncB type="gamma" exponent="1" />
      </feComponentTransfer>
    </filter>
    <filter id="regular-filter" x="0" y="0" width="100%" height="100%">
      <feColorMatrix in="SourceGraphic" type="hueRotate" values="1" />
      <feComponentTransfer>
        <feFuncR type="gamma" exponent="2" />
        <feFuncG type="gamma" exponent="2" />
        <feFuncB type="gamma" exponent="2" />
      </feComponentTransfer>
    </filter>
    <filter id="bold-filter" x="0" y="0" width="100%" height="100%">
      <feComponentTransfer>
        <feFuncR type="gamma" exponent="3" />
        <feFuncG type="gamma" exponent="3" />
        <feFuncB type="gamma" exponent="3" />
      </feComponentTransfer>
    </filter>
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
        stop-opacity="0.9"
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
        stop-opacity="0.9"
        :offset="`${stop.percentage}%`" />
    </linearGradient>
  </defs>
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
