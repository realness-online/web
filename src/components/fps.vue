<script setup>
  import { ref, onMounted as mounted, onUnmounted as unmounted } from 'vue'
  import { useFps } from '@vueuse/core'

  const fps = useFps()
  const animation_time = ref(0)
  const max_cycle_time = 172 // Longest animation cycle in seconds

  let frame_id = null

  const update_animation_time = () => {
    const svg_element = document.querySelector('svg[itemtype="/posters"]')
    if (svg_element) {
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
  <span id="fps">
    {{ fps }}fps
    <span class="time">
      {{ animation_time.toFixed(0) }}s / {{ max_cycle_time }}s
    </span>
  </span>
</template>

<style lang="stylus">
  span#fps
    position: fixed
    bottom: base-line * .5
    right: base-line * .5
    padding: base-line * .5
    border-radius: base-line * .5
    background: rgba(0, 0, 0, 0.66)
    color: red
    font-size: base-line
    text-shadow: -0.66px -0.66px .51px blue
    z-index: 1000
    display: flex
    flex-direction: column
    gap: base-line * .25

    .time
      color: cyan
      font-size: base-line * .5
</style>
