<script setup>
  import icon from '@/components/icon'
</script>

<template>
  <router-link class="logo" to="/" tabindex="-1">
    <icon name="realness" />
  </router-link>
</template>

<style lang="stylus">
  svg.realness:active {
    transition-property: transform;
    transition-duration: 0.52s;
    transition-timing-function: var(--ease-click);
    transform: scale(0.95);
  }
</style>
