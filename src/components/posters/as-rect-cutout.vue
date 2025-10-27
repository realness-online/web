<script setup>
  import {
    ref,
    computed,
    inject
  } from 'vue'

  const props = defineProps({
    page: {
      type: Number,
      required: true
    }
  })

  defineEmits(['focus', 'touchstart', 'touchend', 'touchmove'])
  const vector = inject('vector', ref(null))

  const pattern_id = computed(() => {
    if (!vector.value?.id) return ''
    return `${vector.value.id}-cutouts-${props.page}`
  })

</script>

<template>
  <defs>
    <symbol
      :key="page"
      :id="`${pattern_id}-symbol`"
      tabindex="-1"
      v-html="page" />
    <pattern
      :id="pattern_id"
      :viewBox="`0 0 ${vector.width} ${vector.height}`"
      width="100%"
      height="100%"
      patternUnits="userSpaceOnUse"
      @focus="$emit('focus', 'cutout')"
      @touchstart="$emit('touchstart', $event)"
      @touchend="$emit('touchend', $event)"
      @touchmove="$emit('touchmove', $event)">
      <use :href="`#${pattern_id}-symbol`" />
    </pattern>
  </defs>
  <rect :fill="`url(#${pattern_id})`"  width="100%" height="100%" />
</template>
