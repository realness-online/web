<template>
  <aside itemscope :itemid="itemid">
    <meta
      v-for="person in people"
      :key="person.id"
      itemprop="relations"
      itemscope
      :itemid="person.id" />
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
      itemid() {
        return `${localStorage.me}/relations`
      }
    }
  }
</script>
