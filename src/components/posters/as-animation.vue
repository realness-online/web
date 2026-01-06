<script setup>
  /** @typedef {import('@/types').Id} Id */
  import {
    ref,
    watchEffect,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import { as_fragment_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import { animate, stroke, animation_speed } from '@/utils/preference'

  const props = defineProps({
    id: {
      type: String,
      required: true,
      /** @type {(id: string) => id is Id} */
      validator: is_vector_id
    }
  })

  /** @param {string} add */
  const fragment = add =>
    `${as_fragment_id(/** @type {Id} */ (props.id))}-${add}`

  /**
   * Calculates duration based on animation speed preference
   * @param {number} base_duration - Base duration in seconds
   * @returns {string} Duration string with speed multiplier applied
   */
  const duration = base_duration => {
    const speed_multipliers = {
      fast: 0.5,
      normal: 1,
      slow: 2,
      very_slow: 4,
      glacial: 8
    }
    const multiplier = speed_multipliers[animation_speed.value] || 1
    return `${base_duration * multiplier}s`
  }

  const static_stroke_opacity = '0.90'
  const static_fill_opacity = '0.90'
  const static_stroke_width = '0.33'

  const MAX_STEP_SIZE = 40
  const MAX_MOMENTUM_MULTIPLIER = 5
  const STEP_SIZE_SHIFT = 10
  const STEP_SIZE_DEFAULT = 0.5
  const MOMENTUM_FACTOR = 0.5

  const animation_group = ref(null)

  let last_key_time = 0
  let key_press_count = 0
  let last_key = null
  let last_had_shift = false
  let is_processing = false
  const momentum_reset_delay = 500
  const throttle_delay = 64

  /**
   * @param {KeyboardEvent} event
   */
  const handle_keydown = event => {
    if (!animation_group.value) return

    const svg_element = animation_group.value.closest('svg')
    if (!svg_element) return

    const is_arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    if (!is_arrow) return

    event.preventDefault()

    if (is_processing) return
    is_processing = true
    setTimeout(() => {
      is_processing = false
    }, throttle_delay)

    const now = Date.now()
    const same_key = event.key === last_key && event.shiftKey === last_had_shift

    if (now - last_key_time > momentum_reset_delay || !same_key)
      key_press_count = 0

    key_press_count++
    last_key_time = now
    last_key = event.key
    last_had_shift = event.shiftKey

    // Base step increases with momentum
    const base_step = event.shiftKey ? STEP_SIZE_SHIFT : STEP_SIZE_DEFAULT
    const momentum_multiplier = Math.min(
      key_press_count * MOMENTUM_FACTOR,
      MAX_MOMENTUM_MULTIPLIER
    )
    const step = Math.min(base_step * (1 + momentum_multiplier), MAX_STEP_SIZE)

    const current_time = svg_element.getCurrentTime()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const new_time = Math.max(0, current_time + step * direction)

    svg_element.setCurrentTime(new_time)
  }

  watchEffect(() => {
    if (!animation_group.value) return

    const svg_element = animation_group.value.closest('svg')
    if (!svg_element) return

    if (animate.value) svg_element.unpauseAnimations()
    else svg_element.pauseAnimations()
  })

  mounted(() => {
    window.addEventListener('keydown', handle_keydown)
  })

  unmounted(() => {
    window.removeEventListener('keydown', handle_keydown)
  })
</script>

<template>
  <animate ref="animation_group" itemprop="timeline">
    <animate v-if="stroke" class="stroke animation" id="stroke-animation">
      <animate
        :href="fragment('light')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(5)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(8)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(13)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        :dur="duration(11)"
        begin="0s"
        :values="`${static_stroke_opacity};0.1;${static_stroke_opacity}`" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(10)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.45;${static_stroke_width}`" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(14)"
        begin="0s"
        :values="`${static_stroke_width};0.66;0.1;${static_stroke_width}`" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(8)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.77;0.1;${static_stroke_width}`" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        :dur="duration(10)"
        begin="0s"
        :values="`${static_stroke_width};0.1;0.66;0.1;${static_stroke_width}`" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(8)"
        begin="0s"
        values="0;-24"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(12)"
        begin="0s"
        values="0;-34"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(6)"
        begin="0s"
        values="0;-44"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        :dur="duration(8)"
        begin="0s"
        values="0;-56"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
    </animate>

    <animate id="default-animation">
      <animate
        :href="fragment('light')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(12)"
        begin="0s"
        :values="`${static_fill_opacity};0.75;${static_fill_opacity};0.21;${static_fill_opacity}`" />
      <animate
        :href="fragment('medium')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(24)"
        begin="0s"
        :values="`${static_fill_opacity};0.6;${static_fill_opacity};0.5;${static_fill_opacity}`" />
      <animate
        :href="fragment('bold')"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(16)"
        begin="0s"
        :values="`${static_fill_opacity};0.75;${static_fill_opacity};0.6;0.8;${static_fill_opacity};`" />

      <animate
        :href="fragment('radial-background')"
        attributeName="cx"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;150%;-50%;200%;0%" />
      <animate
        :href="fragment('radial-background')"
        attributeName="cy"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;200%;-25%;150%;0%" />
      <animate
        :href="fragment('vertical-light')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;-50%;150%;200%;0%" />
      <animate
        :href="fragment('vertical-light')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(172)"
        begin="0s"
        values="0%;250%;-75%;175%;0%" />
      <animate
        :href="fragment('horizontal-regular')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;200%;-100%;300%;0%" />
      <animate
        :href="fragment('horizontal-regular')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;-50%;200%;150%;0%" />
      <animate
        :href="fragment('vertical-medium')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;175%;-75%;225%;0%" />
      <animate
        :href="fragment('vertical-medium')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="0s"
        values="0%;300%;-100%;200%;0%" />
      <animate
        :href="fragment('vertical-bold')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(68)"
        begin="0s"
        values="0%;-100%;200%;300%;0%" />
      <animate
        :href="fragment('vertical-bold')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(110)"
        begin="indefinite"
        values="0%;250%;-150%;175%;0%" />

      <animate
        :href="fragment('radial')"
        attributeName="cx"
        repeatCount="indefinite"
        :dur="duration(84)"
        begin="0s"
        values="0%;200%;-100%;250%;0%" />
      <animate
        :href="fragment('radial')"
        attributeName="cy"
        repeatCount="indefinite"
        :dur="duration(134)"
        begin="0s"
        values="0%;-75%;300%;150%;0%" />

      <animate
        :href="fragment('vertical-background')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(76)"
        begin="0s"
        values="0%;300%;-150%;200%;0%" />
      <animate
        :href="fragment('vertical-background')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(122)"
        begin="0s"
        values="0%;175%;-100%;250%;0%" />

      <animate
        :href="fragment('horizontal-light')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(94)"
        begin="0s"
        values="0%;-100%;250%;300%;0%" />
      <animate
        :href="fragment('horizontal-light')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(146)"
        begin="0s"
        values="0%;300%;-200%;175%;0%" />

      <animate
        :href="fragment('horizontal-medium')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(58)"
        begin="0s"
        values="0%;225%;-125%;275%;0%" />
      <animate
        :href="fragment('horizontal-medium')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(102)"
        begin="0s"
        values="0%;-150%;250%;200%;0%" />

      <animate
        :href="fragment('horizontal-bold')"
        attributeName="x1"
        repeatCount="indefinite"
        :dur="duration(72)"
        begin="0s"
        values="0%;350%;-200%;300%;0%" />
      <animate
        :href="fragment('horizontal-bold')"
        attributeName="y1"
        repeatCount="indefinite"
        :dur="duration(116)"
        begin="0s"
        values="0%;275%;-175%;225%;0%" />

      <animate
        href="#lightbar-back"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(5)"
        begin="0s"
        values="1;0.66;1"
        keyTimes="0;0.33;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        href="#lightbar-front"
        attributeName="fill-opacity"
        repeatCount="indefinite"
        :dur="duration(5)"
        begin="0s"
        values="1;0.66;1"
        keyTimes="0;0.66;1"
        keySplines="0.4 0 0.6 1" />
    </animate>
  </animate>
</template>

<style lang="stylus">
  g[itemprop='animation'] {
    & animate {
      animation-play-state: paused;
    }
  }

  svg.animate {
    & g[itemprop='animation'] animate {
      animation-play-state: running;
    }
    & path[itemprop] {
      stroke-dashoffset: 0;
    }
    & path[itemprop='light'] {
      stroke-dasharray: 8, 16;
    }
    & path[itemprop='regular'] {
      stroke-dasharray: 13, 21;
    }
    & path[itemprop='medium'] {
      stroke-dasharray: 18, 26;
    }
    & path[itemprop='bold'] {
      stroke-dasharray: 4, 32;
    }
    & path[itemprop='cutout'] {
      filter: brightness(1) saturate(1);
      animation-play-state: paused;
      transition: fill-opacity ease-in-out 0.8s;
      &:focus {
        outline: none;
      }
      &:hover {
        will-change: fill-opacity;
        animation: fade-back ease-out 0.4s 1s forwards;
        animation-iteration-count: 1;
        animation-delay: 1s;
        fill-opacity: 0.75;
      }
      &:active {
        filter: brightness(1.1) saturate(1.1);
        opacity: 0.9;
      }
    }
  }

  @keyframes fade-back {
    to {
      fill-opacity: 0.5;
    }
  }
</style>
