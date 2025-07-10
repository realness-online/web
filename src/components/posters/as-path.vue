<script setup>
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    computed,
    inject,
    nextTick
  } from 'vue'
  import { is_path } from '@/use/path'
  import { is_vector_id } from '@/use/poster'
  import { stroke as stroke_pref, fill as fill_pref } from '@/utils/preference'
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
  const new_poster = ref(inject('new-poster', false))
  const wants_both = computed(() => {
    if (new_poster.value) return false
    return stroke_pref.value && fill_pref.value
  })
  const just_stroke = computed(() => {
    if (new_poster.value) return false
    return !fill_pref.value && stroke_pref.value
  })
  const just_fill = computed(() => {
    if (new_poster.value) return true
    return fill_pref.value
  })
  const path = ref(null)
  const fill = ref(undefined)
  const stroke = ref(undefined)
  const d = ref(undefined)
  const fill_opacity = ref('0.90')
  const stroke_opacity = ref('0.90')
  const stroke_width = ref('0.33')
  const path_length = ref(0)

  mounted(() => {
    fill.value = props.fill
    stroke.value = props.stroke
    d.value = props.path.getAttribute('d')
    if (props.path.style.color) stroke.value = props.path.style.color
    if (props.path.style.fill) fill.value = props.path.style.fill

    // Calculate path length for dash animation
    nextTick(() => {
      if (path.value) {
        path_length.value = path.value.getTotalLength()
      }
    })
  })
  watch_effect(() => (d.value = props.path?.getAttribute('d')))
</script>

<template>
  <path
    :id="props.id"
    ref="path"
    :d="d"
    :mask="props.mask"
    :itemprop="props.itemprop"
    :fill="wants_both || just_fill ? fill : 'none'"
    :fill-opacity="wants_both || just_fill ? '0.90' : undefined"
    :fill-rule="wants_both || just_fill ? 'evenodd' : undefined"
    :stroke="wants_both || just_stroke ? stroke : 'none'"
    :stroke-opacity="wants_both || just_stroke ? stroke_opacity : undefined"
    :stroke-width="wants_both || just_stroke ? stroke_width : undefined" />
</template>

<style>
  path[itemprop] {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    stroke-dasharray: 13, 21;
    stroke-dashoffset: 0;
    transition-duration: 0.66s;
    &:focus {
      outline: none;
    }
    &:active {
      fill-opacity: 0.99;
    }
  }
  path[itemprop='light'] {
    stroke-dasharray: 8, 16;
  }
  path[itemprop='regular'] {
    stroke-dasharray: 13, 21;
  }
  path[itemprop='medium'] {
    stroke-dasharray: 18, 26;
  }
  path[itemprop='bold'] {
    stroke-dasharray: 24, 32;
  }
</style>
