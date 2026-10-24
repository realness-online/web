<script setup>
  import {
    ref,
    computed,
    watch,
    onMounted as mounted,
    onUnmounted as unmounted
  } from 'vue'
  import { useFps as use_fps } from '@vueuse/core'
  import {
    animate,
    animation_speed,
    aspect_ratio_mode,
    drama_back,
    drama_front
  } from '@/utils/preference'
  import {
    BASE_DURATION,
    ANIMATION_SPEED_MULTIPLIERS
  } from '@/utils/animation-config'

  const FPS_ACCEPTABLE = 24
  const FPS_LOW = 12
  const FPS_SNAP_THRESHOLD = 59
  const SMOOTH_ALPHA = 0.35

  const fps_raw = use_fps()
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

  const aspect_ratio = computed(() => aspect_ratio_mode.value || 'auto')

  const fps_color = computed(() => {
    if (fps.value >= FPS_ACCEPTABLE) return 'var(--accent)'
    if (fps.value >= FPS_LOW) return 'var(--warning)'
    return 'var(--emphasis)'
  })

  const fps_style = computed(() => ({
    '--animate': animate.value ? 1 : 0,
    '--slice': aspect_ratio_mode.value !== 'auto' ? 1 : 0,
    '--animate-color': animate.value ? 'var(--accent)' : 'var(--gravel)',
    '--slice-color':
      aspect_ratio_mode.value !== 'auto' ? 'var(--sand)' : 'var(--rocks)',
    '--fps-color': fps_color.value
  }))

  const lights = computed(() => [
    {
      side: 'left',
      on: drama_front.value,
      label: `left light ${drama_front.value ? 'on' : 'off'}`
    },
    {
      side: 'right',
      on: drama_back.value,
      label: `right light ${drama_back.value ? 'on' : 'off'}`
    }
  ])

  const animation_time = ref(0)
  const max_cycle_time = computed(() => {
    const multiplier = ANIMATION_SPEED_MULTIPLIERS[animation_speed.value] || 1
    return BASE_DURATION * multiplier
  })

  let frame_id = null

  const find_poster_svg = () => {
    const animating = document.querySelectorAll(
      'svg[data-animate][itemtype$="/posters"]'
    )
    const any_poster = document.querySelectorAll('svg[itemtype$="/posters"]')
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
    <div data-lights>
      <output
        v-for="light in lights"
        :key="light.side"
        :data-on="light.on"
        :title="light.label">
        <svg viewBox="0 0 24 16" :data-side="light.side">
          <path d="M4 1h4a7 7 0 0 1 0 14H4z" />
          <line x1="17" y1="3" x2="23" y2="1" />
          <line x1="18" y1="8" x2="24" y2="8" />
          <line x1="17" y1="13" x2="23" y2="15" />
        </svg>
      </output>
    </div>
    <output><span>aspect: </span>{{ aspect_ratio }}</output>
    <output>
      <meter :value="animation_time" :min="0" :max="max_cycle_time">
        {{ animation_time.toFixed(0) }}s / {{ max_cycle_time }}s
      </meter>
      <span><span>anim:</span>{{ animation_status.slice(5) }}</span>
    </output>
  </aside>
</template>

<style>
  aside#fps {
    margin: 0 var(--base-line);
    padding: 0;
    max-inline-size: 100%;
    color: var(--text);
    font-size: var(--base-line);
    line-height: var(--base-line);
    font-family: monospace;
    opacity: 1;
    transition:
      opacity var(--duration-reveal) var(--ease-exit),
      transform var(--duration-reveal) var(--ease-exit);
    &[data-leaving] {
      opacity: 0;
      transform: translateY(calc(var(--base-line) * 0.5));
      pointer-events: none;
    }
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto minmax(0, 1fr) auto;
    justify-content: space-between;
    align-items: center;
    gap: calc(var(--base-line) * 0.25);

    & meter {
      inline-size: 100%;
      block-size: calc(var(--base-line) * 0.5);
      flex-shrink: 0;
      min-inline-size: 0;
    }

    > div:first-of-type {
      display: contents;
      min-inline-size: 0;
      font-size: 66%;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--base-line) * 0.25);
      & > output {
        font-size: inherit;
        flex-shrink: 0;
      }
    }

    > div:first-of-type meter {
      accent-color: var(--fps-color);
      color: var(--fps-color);
      &::-webkit-meter-bar {
        background: transparent;
      }
      &::-webkit-meter-optimum-value {
        background: var(--fps-color);
      }
      &::-webkit-meter-suboptimum-value {
        background: var(--fps-color);
      }
      &::-webkit-meter-even-less-good-value {
        background: var(--fps-color);
      }
      &::-moz-meter-bar {
        background: var(--fps-color);
      }
      &::-moz-meter-optimum::-moz-meter-bar {
        background: var(--fps-color);
      }
      &::-moz-meter-sub-optimum::-moz-meter-bar {
        background: var(--fps-color);
      }
      &::-moz-meter-sub-sub-optimum::-moz-meter-bar {
        background: var(--fps-color);
      }
    }
    > output:nth-of-type(2) > meter {
      accent-color: var(--emphasis);
      color: var(--emphasis);
      opacity: calc(var(--animate) * 1 + (1 - var(--animate)) * 0.3);
      &::-webkit-meter-bar {
        background: transparent;
      }
      &::-webkit-meter-optimum-value {
        background: var(--emphasis);
      }
      &::-moz-meter-bar {
        background: var(--emphasis);
      }
    }
    > output {
      font-size: 66%;
    }
    > div[data-lights] {
      display: flex;
      align-items: center;
      gap: calc(var(--base-line) * 0.25);

      svg {
        height: calc(var(--base-line) * 0.5);
        width: auto;
        overflow: visible;
        fill: none;
        stroke: var(--gravel);
        stroke-width: 2;
        stroke-linecap: round;
        transition: stroke 0.2s ease;
        transform: rotate(45deg);
      }
      svg[data-side='left'] {
        transform: scaleX(-1) rotate(45deg);
      }
      output[data-on='true'] svg {
        fill: var(--accent);
        stroke: var(--accent);
      }
    }
    > output:nth-of-type(2) {
      display: contents;
      min-inline-size: 0;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--base-line) * 0.25);
      white-space: nowrap;
      color: var(--animate-color);
    }
    > output:nth-of-type(2) > span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--emphasis);
      opacity: calc(var(--animate) * 1 + (1 - var(--animate)) * 0.3);
    }
    > output:nth-of-type(1) {
      color: var(--slice-color);
      opacity: calc(var(--slice) * 1 + (1 - var(--slice)) * 0.7);
    }
  }

  aside#fps > output:nth-of-type(2) > span > span,
  aside#fps > output:nth-of-type(1) > span {
    display: none;
  }

  @container chat-buffer (height < 9rem) or (width < 20rem) {
    aside#fps {
      margin: 0 var(--base-line);
    }
  }

  @starting-style {
    aside#fps {
      opacity: 0;
      transform: translateY(calc(var(--base-line) * 0.5));
    }
  }
</style>
