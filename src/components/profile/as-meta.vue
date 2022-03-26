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
<script setup>
  import { computed } from 'vue'
  const props = defineProps({
    people: {
      type: Array,
      required: true
    }
  })
  const itemid = computed(() => `${localStorage.me}/relations`)
</script>
