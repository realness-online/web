<template>
  <linearGradient id="gradient">
    <stop v-for="stop in stops" :offset="`${stop.number}%`" />
  </linearGradient>
</template>
<script setup>
  import is_stop from '@/use/gradient'
  const props = defineProps({
    stops: {
      required:true,
      type: Object,
      validator: is_stops
    }
  })
</script>
<style lang="stylus"></style>
