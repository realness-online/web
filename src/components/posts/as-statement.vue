<template lang="html">
  <div itemscope :itemid="statement.id">
    <p itemprop="what">{{statement.what}}</p>
    <meta itemprop="why" :content="statement.why">
    <meta itemprop="where" :content="statement.where">
  </div>
</template>
<script>
  export default {

  }
</script>
<style lang="stylus">
</style>
