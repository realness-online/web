<template lang="html">
  <aside itemscope :itemid="itemid">
    <meta v-for="person in people" itemprop="relation" :content="person.id" :key="person.id">
  </aside>
</template>
<script>
  export default {
    props: { people: Array },
    computed: {
      itemid() {
        return `${this.me}/relations`        
      }
    }
  }
</script>
