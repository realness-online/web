<template lang="html">
  <router-link id="logo" to="/">
    <svg><use xlink:href="/static/icons.svg#realness"/></svg>
  </router-link>
</template>
<script>
  export default {}
</script>
<style lang="stylus">
  @require '../style/variables'
  a#logo > svg
    width:(base-line * 2)
    height:(base-line * 2)
</style>
