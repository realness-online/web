<script setup>
  import { ref, computed } from 'vue'
  import { is_vector_id } from '@/use/poster'

  const props = defineProps({
    trace: {
      type: Object,
      required: true
    },
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    tabindex: {
      type: Number,
      required: false
    }
  })

  defineEmits(['focus'])
</script>

<template>
  <g class="trace">
    <path
      v-for="(path, index) in trace.paths"
      :key="index"
      :d="path.path"
      :fill="`rgb(${path.color.r}, ${path.color.g}, ${path.color.b})`"
      :tabindex="tabindex"
      @focus="$emit('focus', 'trace')" />
  </g>
</template>

<style lang="stylus">
  .trace
    path
      transition: fill 0.3s ease, stroke 0.3s ease
</style>
