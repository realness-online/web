<script setup>
  import { computed } from 'vue'
  import { useStorage as use_storage } from '@vueuse/core'

  const props = defineProps({
    itemid: {
      type: String,
      required: false,
      default: null
    }
  })

  // Get viewBox transform from localStorage
  const storage_key = computed(() =>
    props.itemid ? `viewbox-${props.itemid}` : 'viewbox-current'
  )
  const viewbox_transform = use_storage(storage_key, {
    x: 0,
    y: 0,
    scale: 1
  })

  // Format coordinates for display - much more concise
  const formatted_coords = computed(() => {
    const { x, y, scale } = viewbox_transform.value
    return `${Math.round(x)},${Math.round(y)} ${scale.toFixed(1)}x`
  })
</script>

<template>
  <span id="viewbox">{{ formatted_coords }}</span>
</template>

<style lang="stylus">
  span#viewbox {
    position: fixed;
    top: base-line * 1.5;
    left: 50%;
    transform: translateX(-50%);
    padding: base-line * .5;
    border-radius: base-line * .5;
    background: rgba(0, 0, 0, 0.66);
    color: blue;
    font-size: smaller;
    text-shadow: -0.66px -0.66px .51px red;
    z-index: 1000;
    font-family: monospace;
  }
</style>
