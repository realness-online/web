<template lang="html">
  <div itemscope :itemid="statement.id">
    <p itemprop="statement">{{ statement.statement }}</p>
    <meta v-if="statement.why" itemprop="why" :content="statement.why">
    <meta v-if="statement.where" itemprop="where" :content="statement.where">
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
