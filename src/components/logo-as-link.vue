<template lang="html">
  <router-link id="logo" to="/">
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
  svg.realness
    width: base-line * 2
    height: base-line * 2
    &:active
      transition-duration: 0.1s
</style>
