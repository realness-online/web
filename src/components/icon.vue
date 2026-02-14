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
  <svg :class="name" class="icon"><use :href="icon_location" /></svg>
</template>

<style lang="stylus">
  svg.icon {
    fill: currentColor
    // standard-shadow: boop;
    &:active {
      transform: scale(0.95);
      outline: 1px double currentColor;
      outline-offset: base-line * 0.25;
    }
    &.gear {
      transition-timing-function: ease;
      transition-duration: 1.66s;
      transition-property: all;
      &:active {
        transform: rotate(-60deg) scale(1.05);
        transition-duration: 0.66s;
      }
      &:hover {
        transform: rotate(60deg) scale(0.95);
      }
    }
  }
</style>
