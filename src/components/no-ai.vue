<script setup>
  import { ref, onUnmounted as unmounted } from 'vue'

  // Easter egg: press and hold the no-ai mark and it stops holding the line.
  // The slash snaps, and the sparkles it was crossing out get loose across
  // the whole viewport before the mark pulls itself back together.
  const HOLD_MS = 1500
  const BREAK_MS = 700
  const SETTLE_MS = 420
  const ESCAPE_MS = 2600
  const SPARK_COUNT = 24
  const SPARK_MIN_SIZE = 12
  const SPARK_MAX_SIZE = 44
  const SPARK_MIN_REACH = 0.35
  const SPARK_MAX_REACH = 1
  const SPARK_MAX_DELAY = 280
  const SPARK_MIN_SPIN = -540
  const SPARK_MAX_SPIN = 540
  const SPARK_ARC_JITTER = 0.5
  const HALF = 2
  const TAU = Math.PI * 2

  /** @typedef {{ id: number, style: Record<string, string> }} Spark */

  /** @type {import('vue').Ref<'straining' | 'escaped' | 'settling' | ''>} */
  const state = ref('')
  /** @type {import('vue').Ref<SVGSVGElement | null>} */
  const mark = ref(null)
  /** @type {import('vue').Ref<Spark[]>} */
  const sparks = ref([])

  let hold_timer = null
  let break_timer = null
  let settle_timer = null
  let escape_timer = null

  const between = (min, max) => min + Math.random() * (max - min)

  const scatter = () => {
    const box = mark.value?.getBoundingClientRect()
    if (!box) return
    const origin_x = box.left + box.width / HALF
    const origin_y = box.top + box.height / HALF
    const reach = Math.hypot(window.innerWidth, window.innerHeight) / HALF
    sparks.value = Array.from({ length: SPARK_COUNT }, (spark, index) => {
      const arc = (index / SPARK_COUNT) * TAU
      const angle = arc + between(-SPARK_ARC_JITTER, SPARK_ARC_JITTER)
      const travel = reach * between(SPARK_MIN_REACH, SPARK_MAX_REACH)
      return {
        id: index,
        style: {
          '--spark-size': `${between(SPARK_MIN_SIZE, SPARK_MAX_SIZE)}px`,
          '--spark-x': `${origin_x}px`,
          '--spark-y': `${origin_y}px`,
          '--spark-fly-x': `${Math.cos(angle) * travel}px`,
          '--spark-fly-y': `${Math.sin(angle) * travel}px`,
          '--spark-spin': `${between(SPARK_MIN_SPIN, SPARK_MAX_SPIN)}deg`,
          '--spark-delay': `${between(0, SPARK_MAX_DELAY)}ms`
        }
      }
    })
    escape_timer = setTimeout(() => (sparks.value = []), ESCAPE_MS)
  }

  const settle = () => {
    state.value = 'settling'
    settle_timer = setTimeout(() => (state.value = ''), SETTLE_MS)
  }

  const break_free = () => {
    state.value = 'escaped'
    scatter()
    break_timer = setTimeout(settle, BREAK_MS)
  }

  /** @param {PointerEvent} event */
  const on_press = event => {
    if (state.value) return
    event.currentTarget?.setPointerCapture?.(event.pointerId)
    state.value = 'straining'
    hold_timer = setTimeout(break_free, HOLD_MS)
  }

  const on_release = () => {
    if (state.value !== 'straining') return
    clearTimeout(hold_timer)
    settle()
  }

  unmounted(() => {
    clearTimeout(hold_timer)
    clearTimeout(break_timer)
    clearTimeout(settle_timer)
    clearTimeout(escape_timer)
  })
</script>

<template>
  <svg
    ref="mark"
    viewBox="0 0 16 16"
    class="icon"
    data-icon="no-ai"
    :data-state="state || undefined"
    :style="{
      '--no-ai-hold': `${HOLD_MS}ms`,
      '--no-ai-break': `${BREAK_MS}ms`,
      '--no-ai-settle': `${SETTLE_MS}ms`
    }"
    @pointerdown="on_press"
    @pointerup="on_release"
    @pointercancel="on_release">
    <circle cx="8" cy="8" r="7" fill="none" stroke-width="1" />
    <g transform="translate(2.4 3) scale(0.62)" stroke="none">
      <path
        data-sparkle="core"
        d="M7.314 5.511h-.001c.1.189.254.343.443.443l3.133 1.655-3.133 1.655c-.189.1-.343.254-.442.442h-.001L5.66 12.84 4.005 9.707a1.061 1.061 0 0 0-.443-.442L.428 7.609l3.133-1.655c.189-.1.343-.254.443-.443L5.659 2.38l1.655 3.131Z" />
      <path
        data-sparkle="high"
        d="M14.068 1.72c.048.09.122.165.213.213l1.512.8-1.512.798a.512.512 0 0 0-.213.214l-.8 1.512-.799-1.512a.512.512 0 0 0-.213-.214l-1.512-.799 1.512-.799a.512.512 0 0 0 .213-.213l.8-1.513.799 1.513Z" />
      <path
        data-sparkle="low"
        d="M13.677 11.866a.511.511 0 0 0 .214.214l1.512.799-1.512.799a.512.512 0 0 0-.214.213l-.799 1.513-.799-1.513a.511.511 0 0 0-.213-.213l-1.513-.8 1.513-.798a.512.512 0 0 0 .213-.214l.8-1.512.798 1.512Z" />
    </g>
    <g transform="rotate(40 8 8)" stroke="none">
      <rect data-slash="head" x="1.2" y="7.7" width="6.5" height="1" />
      <rect data-slash="tail" x="8.3" y="7.7" width="6.5" height="1" />
    </g>
  </svg>
  <teleport to="body">
    <div
      v-if="sparks.length"
      class="no-ai-escape"
      aria-hidden="true"
      :style="{ '--no-ai-escape': `${ESCAPE_MS}ms` }">
      <svg
        v-for="spark in sparks"
        :key="spark.id"
        :style="spark.style"
        viewBox="0.4 2.4 10.5 10.5">
        <path
          d="M7.314 5.511h-.001c.1.189.254.343.443.443l3.133 1.655-3.133 1.655c-.189.1-.343.254-.442.442h-.001L5.66 12.84 4.005 9.707a1.061 1.061 0 0 0-.443-.442L.428 7.609l3.133-1.655c.189-.1.343-.254.443-.443L5.659 2.38l1.655 3.131Z" />
      </svg>
    </div>
  </teleport>
</template>

<style>
  /* Registered so the hold can animate a single build-up number that every
     straining part reads through calc(). */
  @property --no-ai-strain {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  svg.icon[data-icon='no-ai'] {
    --no-ai-strain: 0;
    --no-ai-ease-snap: linear(0, 0.62 18%, 0.94 38%, 1.04 58%, 0.99 78%, 1);
    --no-ai-ease-settle: linear(0, 0.18 22%, 0.62 48%, 0.92 76%, 1);
    overflow: visible;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  svg.icon[data-icon='no-ai'] circle,
  svg.icon[data-icon='no-ai'] path[data-sparkle],
  svg.icon[data-icon='no-ai'] rect[data-slash] {
    transform-box: fill-box;
    transform-origin: center;
  }

  svg.icon[data-icon='no-ai'] circle {
    scale: calc(1 + var(--no-ai-strain) * 0.2);
    stroke-width: calc(1 + var(--no-ai-strain) * 1.1);
  }

  svg.icon[data-icon='no-ai'] path[data-sparkle] {
    scale: calc(1 + var(--no-ai-strain) * 0.4);
  }

  svg.icon[data-icon='no-ai'] rect[data-slash='head'] {
    translate: calc(var(--no-ai-strain) * -1.3px) 0;
  }

  svg.icon[data-icon='no-ai'] rect[data-slash='tail'] {
    translate: calc(var(--no-ai-strain) * 1.3px) 0;
  }

  svg.icon[data-icon='no-ai'][data-state='straining'] {
    animation: no-ai-load var(--no-ai-hold) linear both;
  }

  svg.icon[data-icon='no-ai'][data-state='straining'] circle {
    animation: no-ai-rattle 150ms linear infinite;
  }

  svg.icon[data-icon='no-ai'][data-state='straining'] path[data-sparkle] {
    animation: no-ai-jitter 120ms linear infinite;
  }

  svg.icon[data-icon='no-ai'][data-state='straining']
    path[data-sparkle='high'] {
    animation-delay: -40ms;
  }

  svg.icon[data-icon='no-ai'][data-state='straining'] path[data-sparkle='low'] {
    animation-delay: -80ms;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] circle {
    animation: no-ai-ring-give var(--no-ai-break) var(--no-ai-ease-snap) both;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] rect[data-slash='head'] {
    animation: no-ai-snap-head var(--no-ai-break) var(--no-ai-ease-snap) both;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] rect[data-slash='tail'] {
    animation: no-ai-snap-tail var(--no-ai-break) var(--no-ai-ease-snap) both;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] path[data-sparkle] {
    --bolt-x: 0px;
    --bolt-y: -5px;
    animation: no-ai-bolt var(--no-ai-break) var(--no-ai-ease-snap) both;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] path[data-sparkle='high'] {
    --bolt-x: 5px;
    --bolt-y: -4px;
  }

  svg.icon[data-icon='no-ai'][data-state='escaped'] path[data-sparkle='low'] {
    --bolt-x: 4px;
    --bolt-y: 5px;
  }

  svg.icon[data-icon='no-ai'][data-state='settling'] circle,
  svg.icon[data-icon='no-ai'][data-state='settling'] path[data-sparkle],
  svg.icon[data-icon='no-ai'][data-state='settling'] rect[data-slash] {
    animation: no-ai-reassemble var(--no-ai-settle) var(--no-ai-ease-settle)
      both;
  }

  @keyframes no-ai-load {
    to {
      --no-ai-strain: 1;
    }
  }

  @keyframes no-ai-jitter {
    0%,
    100% {
      translate: 0 0;
    }
    25% {
      translate: calc(var(--no-ai-strain) * 1.6px)
        calc(var(--no-ai-strain) * -1.3px);
    }
    50% {
      translate: calc(var(--no-ai-strain) * -1.4px)
        calc(var(--no-ai-strain) * 1.5px);
    }
    75% {
      translate: calc(var(--no-ai-strain) * 1.1px)
        calc(var(--no-ai-strain) * 1.2px);
    }
  }

  @keyframes no-ai-rattle {
    0%,
    100% {
      translate: 0 0;
    }
    33% {
      translate: calc(var(--no-ai-strain) * 0.35px)
        calc(var(--no-ai-strain) * -0.3px);
    }
    66% {
      translate: calc(var(--no-ai-strain) * -0.3px)
        calc(var(--no-ai-strain) * 0.35px);
    }
  }

  @keyframes no-ai-ring-give {
    0% {
      scale: 1.09;
      opacity: 1;
    }
    24% {
      scale: 1.3;
      opacity: 0.85;
    }
    100% {
      scale: 0.84;
      opacity: 0;
    }
  }

  @keyframes no-ai-snap-head {
    0% {
      translate: -0.55px 0;
      rotate: 0deg;
      opacity: 1;
    }
    100% {
      translate: -7px -2px;
      rotate: -38deg;
      opacity: 0;
    }
  }

  @keyframes no-ai-snap-tail {
    0% {
      translate: 0.55px 0;
      rotate: 0deg;
      opacity: 1;
    }
    100% {
      translate: 7px 2px;
      rotate: 34deg;
      opacity: 0;
    }
  }

  @keyframes no-ai-bolt {
    0% {
      translate: 0 0;
      scale: 1;
      opacity: 1;
    }
    26% {
      scale: 1.5;
      opacity: 1;
    }
    100% {
      translate: var(--bolt-x) var(--bolt-y);
      scale: 0.2;
      opacity: 0;
    }
  }

  @keyframes no-ai-reassemble {
    0% {
      opacity: 0;
      scale: 0.7;
    }
    100% {
      opacity: 1;
      scale: 1;
    }
  }

  div.no-ai-escape {
    --no-ai-ease-fly: linear(0, 0.42 16%, 0.76 38%, 0.93 62%, 0.99 82%, 1);
    position: fixed;
    inset: 0;
    z-index: 8;
    overflow: hidden;
    pointer-events: none;
  }

  div.no-ai-escape > svg {
    position: absolute;
    left: var(--spark-x);
    top: var(--spark-y);
    width: var(--spark-size);
    height: var(--spark-size);
    margin: calc(var(--spark-size) / -2);
    overflow: visible;
    fill: var(--emphasis);
    animation: no-ai-loose var(--no-ai-escape) var(--no-ai-ease-fly)
      var(--spark-delay) both;
  }

  @keyframes no-ai-loose {
    0% {
      translate: 0 0;
      rotate: 0deg;
      scale: 0.2;
      opacity: 0;
    }
    10% {
      scale: 1;
      opacity: 1;
    }
    100% {
      translate: var(--spark-fly-x) var(--spark-fly-y);
      rotate: var(--spark-spin);
      scale: 1.15;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    svg.icon[data-icon='no-ai'],
    svg.icon[data-icon='no-ai'] circle,
    svg.icon[data-icon='no-ai'] path[data-sparkle],
    svg.icon[data-icon='no-ai'] rect[data-slash] {
      animation: none;
    }

    svg.icon[data-icon='no-ai'][data-state='escaped'] rect[data-slash],
    svg.icon[data-icon='no-ai'][data-state='escaped'] path[data-sparkle] {
      opacity: 0;
    }

    div.no-ai-escape > svg {
      translate: var(--spark-fly-x) var(--spark-fly-y);
      animation-name: no-ai-loose-still;
      animation-timing-function: linear;
    }

    @keyframes no-ai-loose-still {
      0%,
      100% {
        opacity: 0;
      }
      20%,
      65% {
        opacity: 1;
      }
    }
  }
</style>
