<script setup>
  import {
    ref,
    computed,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import { useFps } from '@vueuse/core'
  import {
    animate,
    animation_speed,
    aspect_ratio_mode,
    slice
  } from '@/utils/preference'
  import { BASE_DURATION } from '@/utils/animation-config'

  const FPS_GOOD_THRESHOLD = 51
  const FPS_MIN_ACCEPTABLE = 24
  const FPS_ACCEPTABLE = 50

  const fps = useFps()

  const animation_status = computed(() => {
    if (!animate.value) return 'anim:off'
    return `anim:${animation_speed.value}`
  })

  const aspect_ratio = computed(() => aspect_ratio_mode.value || 'auto')

  const fps_color = computed(() => {
    if (fps.value >= FPS_GOOD_THRESHOLD) return 'green'
    if (fps.value < FPS_MIN_ACCEPTABLE) return 'red'
    if (fps.value < FPS_ACCEPTABLE) return 'orange'
    return 'green'
  })

  const fps_style = computed(() => ({
    '--animate': animate.value ? 1 : 0,
    '--slice': slice.value ? 1 : 0,
    '--animate-color': animate.value ? 'var(--blue)' : 'grey',
    '--slice-color': slice.value ? 'yellow' : 'grey',
    '--fps-color': fps_color.value
  }))

  const animation_time = ref(0)
  const max_cycle_time = BASE_DURATION

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
  <aside id="fps" :style="fps_style">
    <meter :value="fps" :min="0" :max="60" :optimum="60" :low="24" :high="55">
      {{ fps }}fps
    </meter>
    <meter :value="animation_time" :min="0" :max="max_cycle_time">
      {{ animation_time.toFixed(0) }}s / {{ max_cycle_time }}s
    </meter>
    <output>{{ animation_status }}</output>
    <output>aspect: {{ aspect_ratio }}</output>
  </aside>
</template>

<style lang="stylus">
  aside#fps
    position: fixed
    bottom: base-line * .5
    right: base-line * .5
    padding: base-line * .5
    border-radius: base-line * .5
    background: rgba(0, 0, 0, 0.9)
    color: var(--white-text)
    font-size: base-line
    text-shadow: 0 0 2px black
    z-index: 8
    font-family: monospace
    display: flex
    flex-direction: column
    gap: base-line * .25

    > meter:first-of-type
      accent-color: var(--fps-color)
      color: var(--fps-color)
      &::-webkit-meter-bar
        background: transparent
      &::-webkit-meter-optimum-value
        background: var(--fps-color)
      &::-webkit-meter-suboptimum-value
        background: var(--fps-color)
      &::-webkit-meter-even-less-good-value
        background: var(--fps-color)
      &::-moz-meter-bar
        background: var(--fps-color)
      &::-moz-meter-optimum::-moz-meter-bar
        background: var(--fps-color)
      &::-moz-meter-sub-optimum::-moz-meter-bar
        background: var(--fps-color)
      &::-moz-meter-sub-sub-optimum::-moz-meter-bar
        background: var(--fps-color)
    > meter:last-of-type
      accent-color: blue
      color: blue
      font-size: 66%
      &::-webkit-meter-bar
        background: transparent
      &::-webkit-meter-optimum-value
        background: blue
      &::-moz-meter-bar
        background: blue
    > output
      font-size: 66%
    > output:nth-of-type(1)
      color: var(--animate-color)
      opacity: calc(var(--animate) * 1 + (1 - var(--animate)) * 0.7)
    > output:nth-of-type(2)
      color: var(--slice-color)
      opacity: calc(var(--slice) * 1 + (1 - var(--slice)) * 0.7)
</style>
