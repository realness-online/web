<template>
  <g v-if="animate" itemprop="animation">

    <animate
      :href="fragment('vertical-light')"
      attributeName="x1"
      attributeType="XML"
      repeatCount="indefinite"
      dur="8s"
      values="0%;33%;0%;" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="y1"
      attributeType="XML"
      repeatCount="indefinite"
      dur="13s"
      values="0%;33%;0%" />

    <animate
      :href="fragment('horizontal-regular')"
      attributeName="x1"
      attributeType="XML"
      repeatCount="indefinite"
      dur="21s"
      values="0%;33%;0%" />
    <animate
      :href="fragment('horizontal-regular')"
      attributeName="y1"
      attributeType="XML"
      repeatCount="indefinite"
      dur="13s"
      values="0%;33%;0%" />
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
