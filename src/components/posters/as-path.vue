<template>
  <path ref="path" :d="d" :style="style" />
</template>
<script setup>
  import { ref, watch, watchEffect, inject } from 'vue'
  import { is_path } from '@/use/vector'
  const path = ref(null)
  const props = defineProps({
    path: {
      type: Object,
      required: true,
      validate: is_path
    }
  })
  const as_stroke = ref(inject('as_stroke', false))
  const d = ref(props.path.getAttribute('d'))
  const style = ref(props.path.getAttribute('style'))
  const fill = ref(null)
  const opacity = ref(null)
  watch(as_stroke, () => {
    if (as_stroke.value) {
      fill.value = path.value.style.fill
      opacity.value = path.value.style.fillOpacity
      path.value.style.fillOpacity = '0.01'
    } else {
      path.value.style.fill = fill.value
      path.value.style.fillOpacity = opacity.value
    }
  })
  watchEffect(() => (d.value = props.path.getAttribute('d')))
</script>
<style lang="stylus">
  path[itemprop]
    color: black-dark
    stroke: currentColor
    stroke-width: base-line * 0.033
    stroke-opacity: 0.33
    outline: none

    &:active
      outline:none
      fill-opacity: 1
      transition-delay: 0.33s
      stroke: transparent
</style>
