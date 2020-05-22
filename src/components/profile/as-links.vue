<template lang="html">
  <aside itemscope :itemid="itemid">
    <meta v-for="person in people" :key="person.id" itemprop="relation" :content="person.id">
  </aside>
</template>
<script>
  export default {
    props: {
      people: {
        type: Array,
        required: true
      }
    },
    computed: {
      itemid () {
        return `${this.me}/relations`
      }
    }
  }
</script>
