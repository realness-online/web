<script setup>
  import { ref, watch, watchEffect, inject } from 'vue'
  import { is_path } from '@/use/vector'
  const path = ref(null)
  const props = defineProps({
    path: {
      type: Object,
      required: true,
      validate: is_path
    },
    tabindex: {
      type: Number,
      required: true
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
<template>
  <path ref="path" :d="d" :tabindex="tabindex" :style="style" />
</template>
<style lang="stylus">
  path[itemprop]
    color: black-dark
    stroke: currentColor
    stroke-width: .33px
    stroke-opacity: 1
    outline: none
    fill: inherit
    &:active
      fill: currentColor
      stroke: transparent
      animation-duration: 0.15s
      animation-name: press
</style>
