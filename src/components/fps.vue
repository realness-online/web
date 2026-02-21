<script setup>
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import { useFps } from '@vueuse/core'
  import {
    adaptive_enabled,
    animate,
    animation_speed,
    aspect_ratio_mode,
    slice
  } from '@/utils/preference'
  import {
    BASE_DURATION,
    ANIMATION_SPEED_MULTIPLIERS
  } from '@/utils/animation-config'

  const FPS_ACCEPTABLE = 24
  const FPS_LOW = 12
  const FPS_SNAP_THRESHOLD = 59
  const SMOOTH_ALPHA = 0.35

  const fps_raw = useFps()
  const fps = ref(fps_raw.value)

  watch(
    fps_raw,
    raw => {
      fps.value =
        raw >= FPS_SNAP_THRESHOLD
          ? raw
          : SMOOTH_ALPHA * raw + (1 - SMOOTH_ALPHA) * fps.value
    },
    { immediate: true }
  )

  const animation_status = computed(() => {
    if (!animate.value) return 'anim:off'
    return `anim:${animation_speed.value}`
  })

  const toggle_adaptive = () => {
    adaptive_enabled.value = !adaptive_enabled.value
  }

  const aspect_ratio = computed(() => aspect_ratio_mode.value || 'auto')

  const fps_color = computed(() => {
    if (fps.value >= FPS_ACCEPTABLE) return 'green'
    if (fps.value >= FPS_LOW) return 'yellow'
    return 'red'
  })

  const fps_style = computed(() => ({
    '--animate': animate.value ? 1 : 0,
    '--slice': slice.value ? 1 : 0,
    '--animate-color': animate.value ? 'var(--blue)' : 'grey',
    '--slice-color': slice.value ? 'yellow' : 'grey',
    '--fps-color': fps_color.value
  }))

  const animation_time = ref(0)
  const max_cycle_time = computed(() => {
    const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed.value] || 1
    return BASE_DURATION * multiplier
  })

  let frame_id = null

  const find_poster_svg = () => {
    const animating = document.querySelectorAll(
      'svg.animate[itemtype="/posters"]'
    )
    const any_poster = document.querySelectorAll('svg[itemtype="/posters"]')
    const svgs = animating.length ? animating : any_poster
    if (!svgs.length) return null
    const in_view = [...svgs].find(svg => {
      const rect = svg.getBoundingClientRect()
      return rect.top < window.innerHeight && rect.bottom > 0
    })
    return in_view || svgs[0]
  }

  const update_animation_time = () => {
    const svg_element = find_poster_svg()
    if (svg_element && svg_element instanceof SVGSVGElement) {
      const max = max_cycle_time.value
      const current = svg_element.getCurrentTime()
      animation_time.value =
        Number.isFinite(max) && max > 0
          ? current % max
          : current % BASE_DURATION
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
    <div>
      <output :style="{ color: 'var(--fps-color)' }"
        >{{ Math.round(fps) }} fps</output
      >
      <meter
        :value="fps"
        :min="0"
        :max="60"
        :optimum="60"
        :low="24"
        :high="55" />
    </div>
    <meter :value="animation_time" :min="0" :max="max_cycle_time">
      {{ animation_time.toFixed(0) }}s / {{ max_cycle_time }}s
    </meter>
    <output>{{ animation_status }}</output>
    <output
      role="button"
      tabindex="0"
      @click="toggle_adaptive"
      @keydown.enter="toggle_adaptive"
      @keydown.space.prevent="toggle_adaptive"
      >adaptive: {{ adaptive_enabled ? 'on' : 'off' }}</output
    >
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

    > div:first-of-type
      display: flex
      align-items: center
      gap: base-line * .25
      & > output
        font-size: 66%
        flex-shrink: 0

    > div:first-of-type meter
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
      cursor: pointer
      &:hover
        text-decoration: underline
    > output:nth-of-type(3)
      color: var(--slice-color)
      opacity: calc(var(--slice) * 1 + (1 - var(--slice)) * 0.7)
</style>
