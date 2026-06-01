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
  </svg>
  <svg v-else :class="name" class="icon"><use :href="icon_location" /></svg>
</template>

<style lang="stylus">
  svg.icon {
    fill: currentColor
    &:active {
      transform: scale(0.95);
    }
    &.animation {
      stroke: currentColor
      stroke-width: 2
      paint-order: stroke fill
      stroke-linejoin: round
      stroke-linecap: round
      .animation-ball,
      .animation-trail-mid,
      .animation-trail-old {
        transform-box: fill-box
        transform-origin: center
      }
    }
    &.add .add-plus {
      transform-box: fill-box
      transform-origin: center
    }
  }
</style>
