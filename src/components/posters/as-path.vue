<template>
  <path
    v-if="wants_both"
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
  <path
    v-else-if="just_stroke"
    :id="id"
    ref="path"
    :d="d"
    fill="none"
    :mask="mask"
    :itemprop="itemprop"
    :stroke="stroke"
    :stroke-opacity="stroke_opacity"
    :stroke-width="stroke_width" />
  <path
    v-if="just_fill"
    :id="id"
    ref="path"
    :d="d"
    :mask="mask"
    :itemprop="itemprop"
    :fill="fill"
    :fill-opacity="fill_opacity"
    fill-rule="evenodd"
    stroke="none" />
</template>
<script setup>
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    computed,
    inject
  } from 'vue'
  import { is_path } from '@/use/path'
  import { is_vector_id } from '@/use/vector'
  import { stroke as stroke_pref, fill as fill_pref } from '@/use/preference'
  const props = defineProps({
    itemprop: {
      type: String,
      required: true,
      validate: itemprop =>
        ['light', 'regular', 'medium', 'bold'].some(valid => valid === itemprop)
    },
    path: {
      type: Object,
      required: true,
      validate: is_path
    },
    tabindex: {
      type: Number,
      required: false
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
  defineEmits(['focus'])
  const wants_both = computed(() => {
    if (inject('new-poster', false)) return false
    return stroke_pref.value && fill_pref.value
  })
  const just_stroke = computed(() => {
    if (inject('new-poster', false)) return false
    return !fill_pref.value && stroke_pref.value
  })
  const just_fill = computed(() => {
    if (inject('new-poster', false)) return true
    return fill_pref.value
  })
  const path = ref(null)
  const fill = ref(undefined)
  const stroke = ref(undefined)
  const d = ref(undefined)
  const fill_opacity = ref('0.90')
  const stroke_opacity = ref('0.90')
  const stroke_width = ref('1.0')
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
  watch_effect(() => (d.value = props.path?.getAttribute('d')))
</script>
<style lang="stylus">
  path[itemprop]
    transition-duration: 0.66s
    &:focus
      outline: none
    &:active
      fill-opacity: 0.99
</style>
