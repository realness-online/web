<template>
  <path
    :id="id"
    ref="path"
    :d="d"
    :mask="mask"
    :itemprop="itemprop"
    :fill="fill"
    :fill-opacity="fill_opacity"
    :stroke="stroke"
    :stroke-opacity="stroke_opacity"
    :stroke-width="stroke_width"
    fill-rule="evenodd" />
</template>
<script setup>
  import { ref, watchEffect as watch_effect, onMounted as mounted } from 'vue'
  import { is_path } from '@/use/path'
  import { is_vector_id } from '@/use/vector'
  const props = defineProps({
    itemprop: {
      type: String,
      required: true,
      validate: itemprop =>
        ['light', 'regular', 'bold'].some(valid => valid === itemprop)
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
    mask: {
      type: String,
      required: false,
      default: ''
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
  const path = ref(null)
  const fill = ref(undefined)
  const stroke = ref(undefined)
  const d = ref(undefined)
  const fill_opacity = ref('0.90')
  const stroke_opacity = ref('0.90')
  const stroke_width = ref('0.25px')
  mounted(() => {
    fill.value = props.fill
    stroke.value = props.stroke
    d.value = props.path.getAttribute('d')
    if (props.path.style?.fillOpacity)
      fill_opacity.value = props.path.style.fillOpacity
    if (props.path.style.strokeOpacity)
      stroke_opacity.value = props.path.style.strokeOpacity
    if (props.path.style.color) stroke.value = props.path.style.color
    if (props.path.style.fill) fill.value = props.path.style.fill
  })
  watch_effect(() => (d.value = props.path.getAttribute('d')))
</script>
<style lang="stylus">
  path[itemprop]
    transition-duration: 0.66s
    &:focus
      outline: none
    &:active
      fill-opacity: 0.99
</style>
