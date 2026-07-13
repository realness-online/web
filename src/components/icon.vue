<script setup>
  import icons from '/icons.svg'
  import { computed, ref, watch, onMounted } from 'vue'
  import { animate, animation_speed, color_cycle } from '@/utils/preference'
  import {
    BASE_DURATION,
    ANIMATION_SPEED_MULTIPLIERS
  } from '@/utils/animation-config'
  import SmaltiGlints from '@/components/smalti-glints.vue'
  const props = defineProps({
    name: {
      type: String,
      required: true
    }
  })
  const icon_location = computed(() => `${icons}#${props.name}`)

  // Same master cycle as posters/as-animation.vue duration(BASE_DURATION)
  const realness_cycle = computed(() => {
    const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed.value] || 1
    return BASE_DURATION * multiplier
  })

  const realness_svg = ref(null)
  const realness_elements = selector => {
    const svg = realness_svg.value
    return svg ? [...svg.querySelectorAll(selector)] : []
  }
  const realness_animations = selector =>
    realness_elements(selector).flatMap(el =>
      typeof el.getAnimations === 'function' ? el.getAnimations() : []
    )
  const rewind = (animations, playing) => {
    for (const animation of animations) {
      const name = animation.animationName || ''
      if (String(name).includes('realness-color') && !color_cycle.value) {
        animation.cancel()
        continue
      }
      animation.currentTime = 0
      if (playing) animation.play()
      else animation.pause()
    }
  }
  const sync_realness_animations = playing =>
    rewind(realness_animations('[data-tile], [data-glint]'), playing)
  onMounted(() => sync_realness_animations(animate.value))
  watch(animate, sync_realness_animations)
  watch(color_cycle, () =>
    requestAnimationFrame(() => sync_realness_animations(animate.value))
  )
  watch(animation_speed, () =>
    requestAnimationFrame(() => sync_realness_animations(animate.value))
  )

  const on_realness_press = event => {
    event.currentTarget?.setPointerCapture?.(event.pointerId)
  }
  const on_realness_release = () =>
    requestAnimationFrame(() => sync_realness_animations(animate.value))
</script>

<template>
  <svg v-if="name === 'animation'" viewBox="0 0 16 16" class="icon animation">
    <path
      class="animation-ball"
      d="M11 1.75a1.85 1.85 0 1 0 0 3.7a1.85 1.85 0 1 0 0-3.7Z" />
    <circle
      class="animation-trail-mid"
      cx="6.75"
      cy="8.25"
      r="1.65"
      fill="none"
      stroke-width="1.25" />
    <circle
      class="animation-trail-old"
      cx="3"
      cy="12.5"
      r="1.15"
      fill="none"
      stroke-width="0.75"
      stroke-dasharray="1.35 1.1" />
  </svg>
  <svg v-else-if="name === 'add'" viewBox="0 0 16 16" class="icon add">
    <path
      class="add-ring"
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm-5.657.343a8 8 0 1 1 11.314 11.314A8 8 0 0 1 2.343 2.343Z" />
    <g class="add-plus">
      <path
        d="M11.5 7.1h-7a.5.5 0 0 0-.5.5v.75a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7.6a.5.5 0 0 0-.5-.5Z" />
      <path
        d="M8.88 11.5v-7a.5.5 0 0 0-.5-.5h-.75a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h.75a.5.5 0 0 0 .5-.5Z" />
    </g>
    <g class="add-satellites">
      <path
        class="add-sat add-sat-tl"
        d="M4.75 3.75h-1.5a.35.35 0 0 0-.35.35v.55a.35.35 0 0 0 .35.35h1.5a.35.35 0 0 0 .35-.35v-.55a.35.35 0 0 0-.35-.35Z" />
      <path
        class="add-sat add-sat-tr"
        d="M12.75 3.75h-1.5a.35.35 0 0 0-.35.35v.55a.35.35 0 0 0 .35.35h1.5a.35.35 0 0 0 .35-.35v-.55a.35.35 0 0 0-.35-.35Z" />
      <path
        class="add-sat add-sat-bl"
        d="M4.75 11.25h-1.5a.35.35 0 0 0-.35.35v.55a.35.35 0 0 0 .35.35h1.5a.35.35 0 0 0 .35-.35v-.55a.35.35 0 0 0-.35-.35Z" />
      <path
        class="add-sat add-sat-br"
        d="M12.75 11.25h-1.5a.35.35 0 0 0-.35.35v.55a.35.35 0 0 0 .35.35h1.5a.35.35 0 0 0 .35-.35v-.55a.35.35 0 0 0-.35-.35Z" />
    </g>
  </svg>
  <svg
    v-else-if="name === 'realness'"
    ref="realness_svg"
    viewBox="-20 -20 232 232"
    class="icon realness"
    :class="{ 'color-cycle': color_cycle }"
    :style="{ '--realness-cycle': `${realness_cycle}s` }"
    @pointerdown="on_realness_press"
    @pointerup="on_realness_release"
    @pointercancel="on_realness_release">
    <defs>
      <path
        id="icon-realness-smalti-ash"
        fill-rule="evenodd"
        d="M0.42 0.51 L4.34 0.40 L3.84 3.66 L0.09 3.57 Z M0.63 4.77 L3.34 4.22 L3.33 7.91 L0.71 7.05 Z M1.05 8.96 L4.01 8.57 L3.41 11.02 L0.51 11.07 Z M0.10 12.15 L3.26 12.40 L3.76 15.94 L0.50 15.72 Z M0.47 16.62 L3.78 16.19 L4.43 20.12 L0.88 19.79 Z M4.55 0.14 L7.87 -0.04 L8.45 3.45 L5.19 3.43 Z M5.32 4.83 L7.53 4.11 L8.62 7.53 L5.35 7.45 Z M4.26 8.58 L8.46 8.18 L7.63 11.37 L5.33 11.85 Z M4.31 12.16 L7.65 11.95 L8.48 15.20 L4.84 15.50 Z M4.40 16.70 L7.68 16.60 L7.67 19.47 L4.43 19.30 Z M9.64 0.78 L12.19 0.87 L12.08 3.44 L9.50 3.72 Z M8.59 4.99 L12.08 4.17 L12.76 7.37 L8.83 7.08 Z M8.58 8.53 L12.12 8.55 L12.27 11.51 L9.63 11.54 Z M9.16 12.85 L12.05 12.05 L12.92 15.92 L8.77 15.21 Z M9.36 16.93 L12.06 16.94 L12.89 19.68 L8.98 19.12 Z M12.82 0.96 L16.41 0.67 L16.43 3.92 L13.49 3.33 Z M12.98 4.69 L16.21 4.14 L16.80 7.95 L13.51 7.31 Z M13.88 8.11 L16.14 8.18 L16.66 11.07 L12.98 11.41 Z M13.46 12.03 L16.56 12.88 L17.31 15.74 L13.60 15.65 Z M12.94 15.92 L16.15 16.90 L16.97 20.08 L12.80 19.71 Z M17.65 0.70 L20.81 1.00 L20.52 3.61 L17.96 4.01 Z M17.96 4.67 L21.38 4.90 L20.85 7.77 L18.16 7.98 Z M17.57 8.77 L21.46 8.52 L21.18 11.43 L17.77 11.68 Z M17.17 12.60 L21.62 12.87 L21.30 15.44 L17.96 15.65 Z M17.60 16.82 L20.53 16.72 L20.46 19.67 L17.65 19.26 Z" />
      <path
        id="icon-realness-smalti-tide"
        fill-rule="evenodd"
        d="M0.80 0.27 L2.79 1.06 L2.90 3.65 L0.58 3.86 Z M0.75 4.95 L3.46 5.03 L3.20 9.00 L0.60 8.99 Z M0.62 9.38 L3.41 9.88 L3.00 12.92 L0.72 13.28 Z M0.78 14.65 L3.46 14.46 L3.27 17.91 L0.29 18.22 Z M3.93 0.86 L7.06 0.74 L6.47 4.30 L4.19 3.71 Z M3.74 5.23 L6.40 5.59 L6.74 8.62 L4.00 8.75 Z M4.37 9.62 L6.64 9.87 L6.59 13.29 L4.10 13.14 Z M4.19 14.42 L6.44 14.85 L6.63 17.74 L4.00 18.20 Z M7.99 0.61 L10.26 0.23 L10.62 3.70 L7.70 3.86 Z M7.54 5.07 L10.11 4.77 L10.36 8.87 L7.77 8.33 Z M7.81 9.39 L10.27 10.10 L10.64 13.17 L7.92 13.20 Z M7.69 14.48 L10.69 14.62 L10.31 18.01 L7.77 17.67 Z M11.47 0.89 L14.01 1.01 L13.59 4.00 L11.36 3.86 Z M11.03 5.37 L13.88 4.99 L13.60 9.03 L11.16 8.25 Z M11.06 9.57 L14.20 9.50 L13.77 12.83 L11.25 12.93 Z M11.16 14.61 L14.24 14.71 L13.60 17.69 L11.52 17.37 Z M14.65 0.59 L17.45 0.83 L17.69 3.97 L14.69 3.75 Z M14.70 4.80 L17.65 4.88 L17.81 8.74 L14.55 8.60 Z M14.94 9.38 L17.52 9.37 L17.72 12.75 L14.96 13.65 Z M15.12 14.15 L17.56 14.07 L17.42 18.14 L15.10 17.35 Z M18.38 0.73 L20.90 0.88 L21.42 4.05 L18.37 4.32 Z M18.48 4.91 L20.97 4.88 L21.38 8.61 L18.61 8.89 Z M18.81 9.51 L21.06 10.14 L21.32 13.10 L18.58 12.92 Z M18.22 13.98 L21.05 14.16 L21.14 18.23 L18.22 17.86 Z" />
      <path
        id="icon-realness-smalti-silt"
        fill-rule="evenodd"
        d="M0.56 0.45 L5.06 0.06 L4.79 3.52 L1.10 2.75 Z M0.69 3.83 L4.56 4.21 L4.60 6.43 L1.16 6.64 Z M0.13 6.90 L4.54 6.62 L4.72 10.15 L0.33 10.27 Z M1.13 10.57 L4.84 10.09 L3.84 13.82 L0.11 12.98 Z M1.08 14.18 L3.95 13.71 L4.14 16.45 L-0.34 16.72 Z M0.14 17.19 L4.05 16.88 L3.80 20.50 L0.85 20.16 Z M4.85 -0.08 L8.94 0.11 L8.84 2.85 L4.97 2.76 Z M5.70 3.66 L9.51 3.55 L9.61 6.80 L5.14 6.03 Z M5.42 6.97 L10.00 6.68 L10.15 9.37 L5.52 9.83 Z M5.15 10.93 L9.87 10.14 L9.54 13.42 L4.70 12.85 Z M5.61 14.16 L9.49 13.82 L9.56 16.43 L6.05 17.20 Z M5.42 16.78 L9.39 17.64 L9.27 19.66 L4.95 20.32 Z M10.65 0.07 L14.75 0.59 L15.30 3.45 L10.34 3.43 Z M11.13 4.11 L14.95 3.80 L14.57 6.88 L10.65 6.73 Z M10.01 6.66 L14.18 7.20 L14.67 9.57 L9.95 10.38 Z M9.76 10.97 L14.99 10.59 L15.34 13.49 L9.66 13.77 Z M10.31 14.36 L15.05 13.51 L13.81 16.17 L10.90 17.01 Z M10.01 16.88 L14.34 17.63 L14.94 20.49 L11.20 20.37 Z M15.99 -0.22 L18.76 0.70 L19.74 2.91 L14.86 2.91 Z M15.19 3.70 L19.47 3.38 L18.88 6.17 L14.86 6.06 Z M15.31 6.70 L20.03 7.15 L19.49 10.05 L15.03 9.38 Z M14.78 10.33 L19.33 10.24 L19.24 13.66 L14.66 13.24 Z M15.26 13.67 L19.91 13.61 L18.82 16.32 L16.22 16.53 Z M14.84 17.82 L19.78 17.80 L19.28 20.43 L14.72 19.81 Z" />
      <path
        id="icon-realness-smalti-ember"
        fill-rule="evenodd"
        d="M0.38 0.51 L3.77 0.17 L3.17 2.99 L0.11 2.97 Z M0.15 4.38 L3.89 4.55 L3.32 7.24 L0.65 7.17 Z M0.07 8.59 L3.54 7.90 L3.03 10.85 L0.90 10.86 Z M0.59 12.61 L3.00 12.06 L3.41 15.52 L0.18 14.91 Z M0.23 15.65 L3.59 16.36 L3.37 18.60 L0.67 19.25 Z M4.51 0.31 L7.64 0.59 L7.42 3.47 L4.12 3.39 Z M4.64 4.54 L7.19 4.67 L7.65 6.90 L4.05 7.07 Z M3.91 8.51 L7.47 8.31 L7.80 11.10 L4.09 10.87 Z M4.22 12.48 L7.43 11.76 L7.27 14.71 L4.48 14.78 Z M4.07 16.20 L7.65 16.18 L7.14 19.17 L4.15 18.57 Z M8.06 0.64 L11.35 0.18 L11.55 3.74 L8.06 3.86 Z M8.05 3.96 L11.24 4.71 L11.33 7.38 L8.26 7.13 Z M8.08 8.18 L11.28 8.68 L10.83 11.00 L8.68 11.38 Z M7.87 12.11 L11.37 12.55 L10.84 15.51 L8.52 14.92 Z M8.30 16.37 L10.99 16.26 L11.29 18.63 L8.05 18.95 Z M11.83 0.88 L14.90 0.22 L15.22 3.46 L12.00 3.27 Z M12.16 4.75 L14.74 4.75 L15.54 7.50 L12.45 7.22 Z M12.60 8.49 L15.31 8.22 L14.87 11.41 L12.39 10.77 Z M11.99 12.20 L14.86 11.82 L14.84 14.68 L11.81 15.03 Z M12.17 16.20 L14.95 15.72 L15.53 19.16 L12.34 19.21 Z M15.90 0.56 L18.86 0.61 L19.33 2.98 L16.34 3.07 Z M15.62 3.97 L19.09 4.70 L19.43 7.01 L16.00 7.75 Z M16.43 8.57 L18.80 8.06 L18.70 11.01 L15.98 11.51 Z M16.22 11.86 L18.73 12.12 L19.40 15.11 L16.34 15.31 Z M16.42 16.06 L18.92 16.03 L19.31 18.82 L15.78 19.35 Z" />
      <path
        id="icon-realness-smalti-rust"
        fill-rule="evenodd"
        d="M-0.22 1.13 L3.64 0.80 L4.81 4.25 L0.13 3.64 Z M0.85 5.45 L4.51 4.79 L4.04 8.02 L0.84 8.06 Z M0.53 9.23 L4.45 8.32 L3.77 12.79 L0.59 12.99 Z M-0.29 12.91 L4.23 13.71 L3.71 17.18 L0.32 16.47 Z M1.03 17.02 L4.96 17.34 L4.00 20.61 L0.42 21.60 Z M4.70 0.51 L8.83 0.12 L8.30 4.18 L5.03 3.82 Z M5.34 4.12 L9.47 5.34 L8.51 8.66 L5.51 7.86 Z M4.78 8.39 L8.78 8.95 L8.91 12.44 L5.25 11.89 Z M4.70 13.42 L8.88 12.83 L8.55 17.51 L5.68 17.12 Z M4.93 17.50 L9.28 17.73 L9.17 20.35 L5.53 20.61 Z M9.58 0.48 L14.39 0.28 L13.88 3.42 L10.61 3.48 Z M9.94 5.01 L13.97 4.65 L13.88 7.41 L10.69 8.26 Z M10.03 8.65 L13.60 9.25 L13.48 11.88 L9.36 13.05 Z M9.37 13.35 L13.99 12.90 L14.15 16.73 L10.63 16.31 Z M9.74 17.42 L13.25 17.52 L13.51 20.91 L10.49 20.80 Z M13.82 0.82 L18.22 -0.31 L18.76 4.22 L14.83 4.36 Z M14.18 5.26 L18.10 5.29 L19.17 8.25 L14.44 8.53 Z M14.94 9.04 L17.62 8.81 L18.64 11.72 L14.42 13.11 Z M14.93 12.96 L17.71 13.44 L18.52 16.44 L14.60 17.53 Z M14.82 17.70 L17.59 17.59 L17.52 21.79 L14.60 21.23 Z" />
      <path
        id="icon-realness-smalti-cinder"
        fill-rule="evenodd"
        d="M0.21 0.42 L2.69 0.43 L2.69 3.05 L0.50 2.98 Z M0.72 3.76 L2.82 3.54 L3.01 5.88 L0.38 5.94 Z M0.60 7.04 L2.84 7.08 L3.04 9.72 L0.39 9.66 Z M0.59 10.48 L3.12 10.19 L2.73 12.73 L0.35 12.61 Z M0.28 13.91 L3.12 13.89 L3.01 15.98 L0.35 15.98 Z M0.18 16.74 L2.82 16.91 L2.93 19.37 L0.22 19.54 Z M3.72 0.45 L6.06 0.38 L6.39 3.11 L3.57 3.09 Z M3.95 3.95 L6.01 4.00 L6.19 6.11 L3.49 6.15 Z M3.57 6.94 L6.36 6.97 L6.32 9.36 L3.53 9.38 Z M3.56 10.16 L6.24 10.48 L5.95 12.87 L3.78 12.50 Z M3.52 13.78 L6.38 13.85 L6.20 15.78 L3.91 15.78 Z M3.93 16.72 L6.42 16.95 L5.97 19.10 L3.62 19.46 Z M6.92 0.21 L9.59 0.26 L9.24 2.67 L6.85 2.69 Z M6.81 3.47 L9.21 3.70 L9.69 6.34 L7.09 5.94 Z M7.32 6.92 L9.45 7.10 L9.39 9.28 L7.30 9.21 Z M6.97 10.47 L9.31 10.08 L9.19 12.87 L7.08 12.66 Z M7.27 13.75 L9.26 13.49 L9.67 15.98 L7.09 15.96 Z M7.32 17.03 L9.63 16.91 L9.55 19.09 L6.84 19.22 Z M10.24 0.73 L12.57 0.50 L12.96 2.86 L10.60 2.96 Z M10.51 3.55 L12.62 3.98 L12.67 6.29 L10.44 6.43 Z M10.39 7.34 L12.93 7.18 L13.01 9.54 L10.33 9.63 Z M10.49 10.40 L12.88 10.38 L12.97 12.76 L10.60 12.71 Z M10.55 13.39 L13.00 13.44 L12.68 15.90 L10.55 16.14 Z M10.32 16.71 L12.72 17.18 L12.95 19.23 L10.65 19.21 Z M13.93 0.23 L15.76 0.53 L15.93 2.91 L13.66 2.66 Z M13.90 3.48 L15.92 3.80 L16.11 6.03 L13.53 5.95 Z M13.85 7.00 L15.86 7.29 L16.21 9.66 L13.70 9.73 Z M13.61 10.60 L16.31 10.42 L16.04 12.81 L13.78 12.59 Z M13.96 13.80 L16.30 13.87 L15.85 15.76 L13.52 16.22 Z M13.93 16.81 L15.96 16.67 L15.95 19.13 L13.74 19.41 Z M17.21 0.24 L19.21 0.30 L19.42 2.80 L17.03 2.54 Z M16.79 3.78 L19.45 3.93 L19.13 6.16 L16.81 6.23 Z M17.19 6.87 L19.07 6.95 L19.56 9.16 L16.72 9.37 Z M16.91 10.58 L19.05 10.62 L19.22 13.02 L17.07 12.54 Z M16.77 13.95 L19.19 13.55 L19.49 15.92 L17.24 15.82 Z M16.72 17.23 L19.30 17.12 L19.23 19.51 L16.96 19.12 Z" />
      <pattern
        id="icon-realness-fill-ash"
        width="21.5"
        height="20.0"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-ash" data-tile="ash" />
      </pattern>
      <pattern
        id="icon-realness-fill-tide"
        width="21.6"
        height="18.4"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-tide" data-tile="tide" />
      </pattern>
      <pattern
        id="icon-realness-fill-silt"
        width="20.0"
        height="20.4"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-silt" data-tile="silt" />
      </pattern>
      <pattern
        id="icon-realness-fill-ember"
        width="19.5"
        height="19.5"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-ember" data-tile="ember" />
      </pattern>
      <pattern
        id="icon-realness-fill-rust"
        width="18.8"
        height="21.5"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-rust" data-tile="rust" />
      </pattern>
      <pattern
        id="icon-realness-fill-cinder"
        width="19.8"
        height="19.8"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti-cinder" data-tile="cinder" />
      </pattern>
    </defs>
    <path
      id="realness-ash"
      data-tile="ash"
      d="M12.52 10.65 L40.16 16.68 L67.38 6.73 L94.91 8.41 L98.34 28.54 L97.35 48.45 L92.06 68.16 L64.17 68.93 L36.23 71.81 L8.53 65.79 L7.58 47.25 L8.14 28.81 Z" />
    <path
      id="realness-tide"
      data-tile="tide"
      d="M94.91 8.41 L122.79 10.38 L150.37 18.39 L178.64 12.68 L181.77 29.65 L182.17 46.93 L184.65 63.97 L153.88 67.35 L123.17 72.26 L92.06 68.16 L97.35 48.45 L98.34 28.54 Z" />
    <path
      id="realness-silt"
      data-tile="silt"
      d="M8.53 65.79 L36.23 71.81 L64.17 68.93 L92.06 68.16 L87.70 85.72 L89.53 103.58 L89.37 121.35 L64.25 116.61 L39.93 126.77 L14.99 125.36 L15.10 105.26 L13.60 85.33 Z" />
    <path
      id="realness-ember"
      data-tile="ember"
      d="M92.06 68.16 L123.17 72.26 L153.88 67.35 L184.65 63.97 L189.29 84.50 L187.58 105.02 L184.60 125.54 L153.03 120.34 L121.42 115.91 L89.37 121.35 L89.53 103.58 L87.70 85.72 Z" />
    <path
      id="realness-rust"
      data-tile="rust"
      d="M14.99 125.36 L39.93 126.77 L64.25 116.61 L89.37 121.35 L90.85 141.12 L96.62 160.25 L98.10 180.02 L70.17 175.00 L42.10 176.81 L14.03 178.15 L10.20 160.48 L16.89 143.00 Z" />
    <path
      id="realness-cinder"
      data-tile="cinder"
      d="M89.37 121.35 L121.42 115.91 L153.03 120.34 L184.60 125.54 L181.45 143.02 L180.07 160.68 L179.36 178.40 L152.34 182.29 L125.09 174.67 L98.10 180.02 L96.62 160.25 L90.85 141.12 Z" />
    <use href="#realness-ash" data-tile="ash" />
    <use href="#realness-tide" data-tile="tide" />
    <use href="#realness-silt" data-tile="silt" />
    <use href="#realness-ember" data-tile="ember" />
    <use href="#realness-rust" data-tile="rust" />
    <use href="#realness-cinder" data-tile="cinder" />
    <smalti-glints />
  </svg>
  <svg v-else :class="name" class="icon"><use :href="icon_location" /></svg>
</template>

<style>
  svg.icon {
    fill: currentColor;
    &:active {
      transform: scale(0.95);
    }
    &.animation {
      overflow: visible;
      stroke: currentColor;
      stroke-width: 2;
      paint-order: stroke fill;
      stroke-linejoin: round;
      stroke-linecap: round;
      .animation-ball,
      .animation-trail-mid,
      .animation-trail-old {
        transform-box: fill-box;
        transform-origin: center;
      }
    }
    &.add {
      overflow: visible;
    }
    &.add .add-plus {
      transform-box: fill-box;
      transform-origin: center;
    }
    &.add .add-satellites {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
      .add-sat {
        transform-box: fill-box;
        transform-origin: center;
      }
    }
    &.realness {
      --ease-drift-out: linear(0, 0.42 24%, 0.82 52%, 0.97 76%, 1);
      --ease-drift-back: linear(0, 0.18 22%, 0.52 48%, 0.84 74%, 1);
      --ease-click: linear(
        0,
        0.42 22%,
        0.87 42%,
        1.09 58%,
        0.96 72%,
        1.03 84%,
        0.99 92%,
        1
      );
    }
    &.realness > [data-tile] {
      transform-box: fill-box;
      transform-origin: center;
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-iteration-count: infinite;
      animation-play-state: paused;
    }
    &.realness > path[data-tile='ash'] {
      fill: url(#icon-realness-fill-ash);
    }
    &.realness > path[data-tile='tide'] {
      fill: url(#icon-realness-fill-tide);
    }
    &.realness > path[data-tile='silt'] {
      fill: url(#icon-realness-fill-silt);
    }
    &.realness > path[data-tile='ember'] {
      fill: url(#icon-realness-fill-ember);
    }
    &.realness > path[data-tile='rust'] {
      fill: url(#icon-realness-fill-rust);
    }
    &.realness > path[data-tile='cinder'] {
      fill: url(#icon-realness-fill-cinder);
    }
    &.realness > [data-tile='ash'] {
      animation-name: realness-drift-up-left;
      animation-duration: 7.4s;
      --snap-x: -2.5px;
      --snap-y: -5px;
      --snap-rot: 0deg;
    }
    &.realness > [data-tile='tide'] {
      animation-name: realness-drift-up-right;
      animation-duration: 6.8s;
      --snap-x: 2.5px;
      --snap-y: -5px;
      --snap-rot: 0deg;
    }
    &.realness > [data-tile='silt'] {
      animation-name: realness-drift-left;
      animation-duration: 7.9s;
      --snap-x: -2.5px;
      --snap-y: 0px;
      --snap-rot: 0deg;
    }
    &.realness > [data-tile='ember'] {
      animation-name: realness-drift-right;
      animation-duration: 7.1s;
      --snap-x: 2.5px;
      --snap-y: 0px;
      --snap-rot: 0deg;
    }
    &.realness > [data-tile='rust'] {
      animation-name: realness-drift-down-left;
      animation-duration: 8.2s;
      --snap-x: -2.5px;
      --snap-y: 5px;
      --snap-rot: 0deg;
    }
    &.realness > [data-tile='cinder'] {
      animation-name: realness-drift-down-right;
      animation-duration: 7.6s;
      --snap-x: 2.5px;
      --snap-y: 5px;
      --snap-rot: 0deg;
    }
    &.realness:active > [data-tile] {
      animation: realness-click-in 0.52s var(--ease-click) forwards;
    }
  }

  @keyframes realness-drift-up-left {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) - 2.74px),
          calc(var(--snap-y) - 3.57px)
        )
        rotate(-0.6deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-drift-up-right {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) + 2.7px),
          calc(var(--snap-y) - 3.6px)
        )
        rotate(0.5deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-drift-left {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) - 4.5px),
          calc(var(--snap-y) - 0.06px)
        )
        rotate(-0.4deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-drift-right {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) + 4.5px),
          calc(var(--snap-y) - 0.16px)
        )
        rotate(0.7deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-drift-down-left {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) - 2.75px),
          calc(var(--snap-y) + 3.56px)
        )
        rotate(0.5deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-drift-down-right {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
      animation-timing-function: var(--ease-drift-out);
    }
    50% {
      transform: translate(
          calc(var(--snap-x) + 2.74px),
          calc(var(--snap-y) + 3.57px)
        )
        rotate(-0.7deg);
      animation-timing-function: var(--ease-drift-back);
    }
    100% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
  }
  @keyframes realness-click-in {
    0% {
      transform: translate(var(--snap-x), var(--snap-y)) rotate(var(--snap-rot));
    }
    100% {
      transform: translate(0, 0) rotate(0deg);
    }
  }

  svg.icon.realness pattern use[data-tile] {
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    animation-play-state: paused;
  }
  svg.icon.realness pattern use[data-tile='ash'],
  svg.icon.realness pattern use[data-tile='cinder'] {
    fill: var(--pumice);
  }
  svg.icon.realness pattern use[data-tile='tide'],
  svg.icon.realness pattern use[data-tile='silt'] {
    fill: var(--water-fill);
  }
  svg.icon.realness pattern use[data-tile='ember'],
  svg.icon.realness pattern use[data-tile='rust'] {
    fill: var(--clay-fill);
  }
  /* Shimmer always; color cycle when .color-cycle (preference) */
  svg.icon.realness pattern use[data-tile='ash'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: 0s;
  }
  svg.icon.realness.color-cycle pattern use[data-tile='ash'] {
    animation-name: realness-color-ash, realness-smalti-shimmer;
    animation-duration: 26s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 4s, 0s;
  }
  svg.icon.realness pattern use[data-tile='ember'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: calc(var(--realness-cycle) * 0.08);
  }
  svg.icon.realness.color-cycle pattern use[data-tile='ember'] {
    animation-name: realness-color-ember, realness-smalti-shimmer;
    animation-duration: 34s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 6.5s, calc(var(--realness-cycle) * 0.08);
  }
  svg.icon.realness pattern use[data-tile='rust'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: calc(var(--realness-cycle) * 0.16);
  }
  svg.icon.realness.color-cycle pattern use[data-tile='rust'] {
    animation-name: realness-color-rust, realness-smalti-shimmer;
    animation-duration: 28s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 5s, calc(var(--realness-cycle) * 0.16);
  }
  svg.icon.realness pattern use[data-tile='tide'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: calc(var(--realness-cycle) * 0.04);
  }
  svg.icon.realness.color-cycle pattern use[data-tile='tide'] {
    animation-name: realness-color-tide, realness-smalti-shimmer;
    animation-duration: 31s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 7s, calc(var(--realness-cycle) * 0.04);
  }
  svg.icon.realness pattern use[data-tile='silt'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: calc(var(--realness-cycle) * 0.12);
  }
  svg.icon.realness.color-cycle pattern use[data-tile='silt'] {
    animation-name: realness-color-silt, realness-smalti-shimmer;
    animation-duration: 23s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 5.5s, calc(var(--realness-cycle) * 0.12);
  }
  svg.icon.realness pattern use[data-tile='cinder'] {
    animation-name: realness-smalti-shimmer;
    animation-duration: calc(var(--realness-cycle) * 0.5);
    animation-delay: calc(var(--realness-cycle) * 0.22);
  }
  svg.icon.realness.color-cycle pattern use[data-tile='cinder'] {
    animation-name: realness-color-cinder, realness-smalti-shimmer;
    animation-duration: 25s, calc(var(--realness-cycle) * 0.5);
    animation-delay: 4.5s, calc(var(--realness-cycle) * 0.22);
  }
  svg.icon.realness > use[data-tile] {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.52s var(--ease-click);
  }
  svg.icon.realness > use[data-tile='ash'],
  svg.icon.realness > use[data-tile='cinder'] {
    fill: var(--pumice);
  }
  svg.icon.realness > use[data-tile='tide'],
  svg.icon.realness > use[data-tile='silt'] {
    fill: var(--water-fill);
  }
  svg.icon.realness > use[data-tile='ember'],
  svg.icon.realness > use[data-tile='rust'] {
    fill: var(--clay-fill);
  }
  svg.icon.realness:active > use[data-tile] {
    opacity: 1;
  }

  @keyframes realness-smalti-shimmer {
    0%,
    100% {
      opacity: 1;
    }
    42% {
      opacity: 0.78;
    }
    58% {
      opacity: 1;
    }
  }
  @keyframes realness-color-ash {
    0%,
    100% {
      fill: var(--pumice);
    }
    25% {
      fill: var(--water-fill);
    }
    50% {
      fill: var(--clay-fill);
    }
    75% {
      fill: var(--slate-fill);
    }
  }
  @keyframes realness-color-ember {
    0%,
    100% {
      fill: var(--clay-fill);
    }
    25% {
      fill: var(--ochre);
    }
    50% {
      fill: var(--water-fill);
    }
    75% {
      fill: var(--slate-fill);
    }
  }
  @keyframes realness-color-rust {
    0%,
    100% {
      fill: var(--clay-fill);
    }
    25% {
      fill: var(--slate-fill);
    }
    50% {
      fill: var(--water-fill);
    }
    75% {
      fill: var(--ochre);
    }
  }
  @keyframes realness-color-tide {
    0%,
    100% {
      fill: var(--water-fill);
    }
    20% {
      fill: var(--sediment);
    }
    40% {
      fill: var(--sand);
    }
    60% {
      fill: var(--gravel);
    }
    80% {
      fill: var(--rocks);
    }
  }
  @keyframes realness-color-silt {
    0%,
    100% {
      fill: var(--water-fill);
    }
    20% {
      fill: var(--boulders);
    }
    40% {
      fill: var(--gravel);
    }
    60% {
      fill: var(--sediment);
    }
    80% {
      fill: var(--rocks);
    }
  }
  @keyframes realness-color-cinder {
    0%,
    100% {
      fill: var(--pumice);
    }
    20% {
      fill: var(--rocks);
    }
    40% {
      fill: var(--sediment);
    }
    60% {
      fill: var(--sand);
    }
    80% {
      fill: var(--gravel);
    }
  }
</style>
