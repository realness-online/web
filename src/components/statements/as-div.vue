<template lang="html">
  <div itemscope :itemid="statement.id">
    <p itemprop="statement">{{statement.statement}}</p>
    <meta itemprop="why" :content="statement.why" v-if="statement.why">
    <meta itemprop="where" :content="statement.where" v-if="statement.where">
  </div>
</template>
<script>
  export default {
    props: {
      statement: {
        type: Object,
        required: true
      }
    }
  }
</script>
<style lang="stylus">
</style>
