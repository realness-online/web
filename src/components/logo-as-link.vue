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
  svg.realness:active
    transition-duration: 0.1s

</style>
