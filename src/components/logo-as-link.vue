<template lang="html">
  <router-link id="logo" to="/">
    <svg><use :xlink:href="realness"/></svg>
  </router-link>
</template>
<script>
  import icons from '@/icons.svg'
  export default {
    computed: {
      realness() {
        return `${icons}#realness`
      }
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  a#logo > svg
    width:(base-line * 2)
    height:(base-line * 2)
</style>
