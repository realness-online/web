<template lang="html">
  <router-link id="logo" to="/"><icon name="realness"></icon></router-link>
</template>
<script>
  import icon from '@/components/icon'
  export default {
    components: { icon }
  }
</script>
<style lang="stylus">
  id="logo"
  svg.realness:active
    padding-top: 0.22em
    transition-duration: 0.1s
    transition-timing-function: ease
    animation-duration: 0s
</style>
