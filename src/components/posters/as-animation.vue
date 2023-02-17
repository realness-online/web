<template>
  <g v-if="animate" itemprop="animation">
    <animate
      :href="fragment('radial-background')"
      attributeName="gradientTransform"
      attributeType="XML"
      repeatCount="indefinite"
      dur="21s"
      values="rotate(0);
              rotate(-60);
              rotate(0);
              rotate(60);
              rotate(0);
              rotate(-180);
              rotate(60);
              rotate(0)" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="gradientTransform"
      attributeType="XML"
      repeatCount="indefinite"
      dur="13s"
      values="rotate(0);
              rotate(-30);
              rotate(0);
              rotate(60);
              rotate(0);
              rotate(-30);
              rotate(60);
              rotate(0)" />
    <animate
      :href="fragment('horizontal-regular')"
      attributeName="gradientTransform"
      attributeType="XML"
      repeatCount="indefinite"
      dur="21s"
      values="rotate(0);
              rotate(-180);
              rotate(0);
              rotate(90);
              rotate(0);
              rotate(-90);
              rotate(180);
              rotate(0);" />
    <animate
      :href="fragment('vertical-bold')"
      attributeName="gradientTransform"
      attributeType="XML"
      repeatCount="indefinite"
      dur="8s"
      values="rotate(0);
              rotate(-90);
              rotate(0);
              rotate(56);
              rotate(0);
              rotate(-10);
              rotate(90);
              rotate(0)" />
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
