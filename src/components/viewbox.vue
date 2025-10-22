<script setup>
  import { computed } from 'vue'

  import {
    animate,
    animation_speed
  } from '@/utils/preference'

  const animation_status = computed(() => {
    if (!animate.value) return 'off'
    return `anim:${animation_speed.value}`
  })
</script>

<template>
  <span id="viewbox">{{ animation_status }}</span>
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
    z-index: 10;
    font-family: monospace;
  }
</style>
