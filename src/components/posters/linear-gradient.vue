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
<template>
  <linearGradient id="gradient">
   <stop v-for="stop in stops" offset="0%" />
   <stop offset="100%" />
 </linearGradient>
</template>
<style lang="stylus"></style>
