<template>
  <use ref="use" />
</template>
<script setup>
  import { ref, watch, watchEffect, inject, onMounted as mounted } from 'vue'
  import { is_use, is_url_query, use as use_layer } from '@/use/layer'
  const use = ref(null)
  const props = defineProps({
    use: {
      type: Object,
      required: true,
      validate: is_use
    },
    fill: {
      type: String,
      required: true,
      validate: is_url_query
    },
    stroke: {
      type: String,
      required: false,
      validate: is_url_query
    }
  })
  const { as_stroke } = use_layer()
  // const style = ref(props.use.getAttribute('style'))

  mounted(() => {
    if (!use.value.style.fill) use.value.style.fill = props.fill
    if (!use.value.style.stroke && props.stroke)
      use.value.style.stroke = props.stroke
  })
  watch(as_stroke, () => {
    if (as_stroke.value) {
      use.value.style.strokeWidth = '1px'
    } else {
      use.value.style.strokeWidth = '0'
    }
  })
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
