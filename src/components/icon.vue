<script setup>
  import icons from '/icons.svg'
  import { computed } from 'vue'
  const props = defineProps({
    name: {
      type: String,
      required: true
    }
  })
  const icon_location = computed(() => `${icons}#${props.name}`)
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
    viewBox="-20 -20 232 232"
    class="icon realness">
    <defs>
      <path
        id="icon-realness-smalti"
        fill-rule="evenodd"
        d="M0.35 0.15 L4.12 0.07 L4.00 3.52 L0.06 3.66 Z M0.04 4.58 L3.50 4.24 L3.88 8.13 L0.13 7.53 Z M0.68 9.24 L4.04 8.70 L4.47 11.50 L0.93 11.74 Z M0.16 12.57 L3.75 13.26 L3.62 16.18 L0.69 15.97 Z M0.59 16.66 L3.48 16.81 L4.15 20.18 L0.34 20.34 Z M4.99 0.30 L8.78 0.70 L8.18 3.73 L5.07 4.03 Z M5.29 4.44 L8.98 4.27 L8.37 8.06 L4.66 7.79 Z M4.54 8.97 L8.75 8.87 L8.87 11.77 L5.25 12.05 Z M5.13 12.90 L8.83 13.39 L8.43 16.27 L4.57 16.30 Z M5.20 17.59 L8.81 16.88 L8.34 20.42 L4.52 20.21 Z M9.18 0.12 L12.48 0.77 L12.56 3.40 L9.42 4.02 Z M9.09 4.60 L13.01 5.03 L13.30 8.16 L9.30 7.72 Z M9.39 9.18 L13.45 8.45 L12.61 11.69 L9.25 11.94 Z M9.64 12.71 L12.42 12.87 L12.82 16.17 L10.03 16.29 Z M9.56 17.22 L13.15 16.65 L13.39 20.53 L9.94 20.55 Z M13.92 0.40 L17.03 0.63 L16.99 3.22 L13.73 3.32 Z M13.87 4.20 L16.92 4.30 L17.03 7.67 L13.53 8.17 Z M14.16 8.45 L17.19 8.65 L17.31 11.58 L14.42 12.44 Z M14.00 12.93 L17.01 12.55 L17.29 15.87 L14.40 15.76 Z M13.52 17.55 L17.49 16.75 L17.51 19.78 L14.07 20.73 Z M18.93 0.69 L21.70 0.37 L21.60 3.92 L18.58 3.93 Z M18.36 4.37 L22.30 5.13 L22.34 8.11 L18.88 8.04 Z M18.24 8.82 L21.80 8.33 L21.45 11.73 L18.28 12.14 Z M19.03 12.90 L22.43 13.43 L22.45 15.97 L18.24 15.83 Z M18.21 16.80 L22.09 17.50 L22.33 20.23 L18.71 20.55 Z" />
      <pattern
        id="icon-realness-pumice"
        width="22.5"
        height="20.75"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti" fill="oklch(0.35 0.01 101)" />
      </pattern>
      <pattern
        id="icon-realness-water"
        width="22.5"
        height="20.75"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti" fill="oklch(0.62 0.07 196)" />
      </pattern>
      <pattern
        id="icon-realness-clay"
        width="22.5"
        height="20.75"
        patternUnits="userSpaceOnUse">
        <use href="#icon-realness-smalti" fill="oklch(0.51 0.13 21)" />
      </pattern>
    </defs>
    <path
      class="realness-tile realness-ash"
      fill="url(#icon-realness-pumice)"
      d="M12.52 10.65 L40.16 16.68 L67.38 6.73 L94.91 8.41 L98.34 28.54 L97.35 48.45 L92.06 68.16 L64.17 68.93 L36.23 71.81 L8.53 65.79 L7.58 47.25 L8.14 28.81 Z" />
    <path
      class="realness-tile realness-tide"
      fill="url(#icon-realness-water)"
      d="M94.91 8.41 L122.79 10.38 L150.37 18.39 L178.64 12.68 L181.77 29.65 L182.17 46.93 L184.65 63.97 L153.88 67.35 L123.17 72.26 L92.06 68.16 L97.35 48.45 L98.34 28.54 Z" />
    <path
      class="realness-tile realness-silt"
      fill="url(#icon-realness-water)"
      d="M8.53 65.79 L36.23 71.81 L64.17 68.93 L92.06 68.16 L87.70 85.72 L89.53 103.58 L89.37 121.35 L64.25 116.61 L39.93 126.77 L14.99 125.36 L15.10 105.26 L13.60 85.33 Z" />
    <path
      class="realness-tile realness-ember"
      fill="url(#icon-realness-clay)"
      d="M92.06 68.16 L123.17 72.26 L153.88 67.35 L184.65 63.97 L189.29 84.50 L187.58 105.02 L184.60 125.54 L153.03 120.34 L121.42 115.91 L89.37 121.35 L89.53 103.58 L87.70 85.72 Z" />
    <path
      class="realness-tile realness-rust"
      fill="url(#icon-realness-clay)"
      d="M14.99 125.36 L39.93 126.77 L64.25 116.61 L89.37 121.35 L90.85 141.12 L96.62 160.25 L98.10 180.02 L70.17 175.00 L42.10 176.81 L14.03 178.15 L10.20 160.48 L16.89 143.00 Z" />
    <path
      class="realness-tile realness-cinder"
      fill="url(#icon-realness-pumice)"
      d="M89.37 121.35 L121.42 115.91 L153.03 120.34 L184.60 125.54 L181.45 143.02 L180.07 160.68 L179.36 178.40 L152.34 182.29 L125.09 174.67 L98.10 180.02 L96.62 160.25 L90.85 141.12 Z" />
  </svg>
  <svg v-else :class="name" class="icon"><use :href="icon_location" /></svg>
</template>

<style lang="stylus">
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
    &.realness .realness-tile {
      transform-box: fill-box;
      transform-origin: center;
      animation-duration: 7s;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      @media (prefers-reduced-motion: reduce) {
        animation-duration: 0.01ms;
      }
    }
    &.realness .realness-ash {
      animation-name: realness-drift-up-left;
    }
    &.realness .realness-tide {
      animation-name: realness-drift-up-right;
    }
    &.realness .realness-silt {
      animation-name: realness-drift-left;
    }
    &.realness .realness-ember {
      animation-name: realness-drift-right;
    }
    &.realness .realness-rust {
      animation-name: realness-drift-down-left;
    }
    &.realness .realness-cinder {
      animation-name: realness-drift-down-right;
    }
  }

  // Tiles are drawn once with their edges permanently touching (the
  // assembled mosaic); each one physically slides outward from the
  // composition's center and back, rather than the shapes themselves
  // resizing, so the gap comes from real motion.
  @keyframes realness-drift-up-left {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-2.74px, -3.57px); }
  }
  @keyframes realness-drift-up-right {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(2.70px, -3.60px); }
  }
  @keyframes realness-drift-left {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-4.50px, -0.06px); }
  }
  @keyframes realness-drift-right {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(4.50px, -0.16px); }
  }
  @keyframes realness-drift-down-left {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-2.75px, 3.56px); }
  }
  @keyframes realness-drift-down-right {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(2.74px, 3.57px); }
  }
</style>
