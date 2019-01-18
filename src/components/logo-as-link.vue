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
  @require '../style/variables'
  svg.realness
    width:(base-line * 2)
    height:(base-line * 2)
</style>
