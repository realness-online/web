<script setup>
  import { useFps } from '@vueuse/core'
  const fps = useFps()
</script>
<template>
  <span id="fps">{{ fps }}fps</span>
</template>
<style lang="stylus">
  span#fps
    position: fixed
    bottom: base-line * .5
    right: base-line * .5
    padding: base-line * .5
    border-radius: base-line * .5
    background: rgba(0, 0, 0, 0.5)
    color: red
    font-size: 1.5rem
    z-index: 1000
</style>
