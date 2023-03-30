<template>
  <router-link id="logo" to="/" tabindex="-1">
    <icon name="realness" />
  </router-link>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: { icon }
  }
</script>
<style lang="stylus">
  svg.realness:active
    outline: 1px double currentColor
    outline-offset: base-line * 0.25
    transition-property: all
    transition-duration: 0.21s
    transform: scale(0.95)
</style>
