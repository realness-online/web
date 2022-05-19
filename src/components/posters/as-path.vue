<template>
  <path
    :id="id"
    ref="path"
    :d="d"
    :itemprop="itemprop"
    :fill="fill"
    :fill-opacity="fill_opacity"
    :stroke="stroke"
    :stroke-opacity="stroke_opacity"
    :stroke-width="stroke_width"
    fill-rule="evenodd" />
</template>
<script setup>
  import { ref, watchEffect as watch_effect, inject } from 'vue'
  import { is_path } from '@/use/path'
  import { is_vector_id } from '@/use/vector'
  const path = ref(null)
  const props = defineProps({
    itemprop: {
      type: String,
      required: true,
      validate: itemprop => {
        console.log(itemprop)
        return ['light', 'regular', 'bold'].some(valid => valid === itemprop)
      }
    },
    path: {
      type: Object,
      required: true,
      validate: is_path
    },
    fill: {
      type: String,
      required: true
    },
    id: {
      type: String,
      required: is_vector_id
    },
    stroke: {
      type: String,
      required: true
    }
  })

  const fill = ref(props.fill)
  const stroke = ref(props.stroke)

  if (props.path.style.color) stroke.value = props.path.style.color
  if (props.path.style.fill) fill.value = props.path.style.fill
  const d = ref(props.path.getAttribute('d'))
  const fill_opacity = ref(props.path.style.fillOpacity)
  const stroke_opacity = ref(props.path.style.strokeOpacity)
  const stroke_width = ref(undefined)
  if (props.path.style.color) stroke_width.value = '0.33px'
  watch_effect(() => (d.value = props.path.getAttribute('d')))
</script>
<style lang="stylus">
  svg:focus-within
    // path
    //   &[itemprop="light"]
    //     animation-timing-function: linear
    //     animation-name: subtle-rotate
    //     animation-duration: 2s
    //     animation-direction: alternate
    //     animation-iteration-count: infinite
    //   &[itemprop="bold"]
    //     animation-timing-function: linear
    //     animation-name: subtle-rotate
    //     animation-duration: 3s
    //     animation-direction: alternate
    //     animation-iteration-count: infinite
  path[itemprop]
    &:focus
      outline: none
    &:active
      fill-opacity: 1
      transition-delay: 0.33s
      stroke: transparent
</style>
