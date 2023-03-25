<template>
  <g v-if="animate" itemprop="animation">
    <animate
      :href="fragment('radial-background')"
      attributeName="cx"
      repeatCount="indefinite"
      dur="86s"
      values="0%;33%;100%;0%;100%;0%;" />
    <animate
      :href="fragment('radial-background')"
      attributeName="cy"
      repeatCount="indefinite"
      dur="55s"
      values="0%;100%;33%;100%;66%;0%" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;33%;100%;0%;100%;0%;" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="86s"
      values="0%;100%;33%;100%;66%;0%" />

    <animate
      :href="fragment('horizontal-regular')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="34s"
      values="0%;100%;66%;0%;33%;100%;0%" />
    <animate
      :href="fragment('horizontal-regular')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;66%;100%;33%;100%;66%;0%" />
  </g>
</template>

<script setup>
  import { use_poster, is_vector } from '@/use/vector'
  import { watchEffect as watch, computed } from 'vue'
  const { fragment, vector } = use_poster()
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      default: null,
      validator: is_vector
    }
  })
  const animate = computed(() => localStorage.animate)
  watch(() => {
    vector.value = props.vector
  })
</script>
<style lang="stylus">
  svg[itemtype="/posters"].animate
    path
      &[itemprop="regular"]
        animation-timing-function: linear
        animation-name: subtle-rotate
        animation-duration: 8s
        animation-direction: alternate
        animation-iteration-count: infinite
</style>