<template>
  <path ref="path" :d="d" fill-rule="evenodd" />
</template>
<script setup>
  import { ref, watchEffect as watch_effect, inject } from 'vue'
  import { is_path } from '@/use/path'
  const path = ref(null)
  const props = defineProps({
    path: {
      type: Object,
      required: true,
      validate: is_path
    }
  })
  const d = ref(props.path.getAttribute('d'))
  const style = ref(props.path.getAttribute('style'))
  // console.log(style.value)
  watch_effect(() => (d.value = props.path.getAttribute('d')))
</script>
<style lang="stylus">
  svg:focus-within
    path
      // &[itemprop="light"]
      //   animation-timing-function: linear
      //   animation-name: subtle-rotate
      //   animation-duration: 2s
      //   animation-direction: alternate
      //   animation-iteration-count: infinite
      // &[itemprop="bold"]
      //   animation-timing-function: linear
      //   animation-name: subtle-rotate
      //   animation-duration: 3s
      //   animation-direction: alternate
      //   animation-iteration-count: infinite
  path[itemprop]
    &:focus
      outline: none
    &:active
      fill-opacity: 1
      transition-delay: 0.33s
      stroke: transparent
</style>
