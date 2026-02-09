<script setup>
  import {
    ref,
    computed,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import {
    animate,
    animation_speed,
    aspect_ratio_mode
  } from '@/utils/preference'

  const animation_status = computed(() => {
    if (!animate.value) return 'off'
    return `anim:${animation_speed.value}`
  })

  const aspect_ratio = computed(() => aspect_ratio_mode.value || 'auto')

  const animation_time = ref(0)
  const max_cycle_time = 172 // Longest animation cycle in seconds

  let frame_id = null

  const update_animation_time = () => {
    const svg_element = document.querySelector('svg[itemtype="/posters"]')
    if (svg_element && svg_element instanceof SVGSVGElement) {
      const current = svg_element.getCurrentTime()
      animation_time.value = current % max_cycle_time
    }
    frame_id = requestAnimationFrame(update_animation_time)
  }

  mounted(() => {
    update_animation_time()
  })

  unmounted(() => {
    if (frame_id) cancelAnimationFrame(frame_id)
  })
</script>

<template>
  <span id="viewbox">
    <span class="animation">{{ animation_status }}</span>
    <span class="time">
      {{ animation_time.toFixed(0) }}s / {{ max_cycle_time }}s
    </span>
    <span class="aspect"> aspect: {{ aspect_ratio }} </span>
  </span>
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
    z-index: 6;
    font-family: monospace;
    display: flex;
    flex-direction: column;
    gap: base-line * .25;

    .animation {
      color: blue;
    }
    .time {
      color: cyan;
    }
    .aspect {
      color: yellow;
    }
  }
</style>
