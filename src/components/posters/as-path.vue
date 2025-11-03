<script setup>
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    computed,
    inject,
    nextTick as tick
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
  const show_stroke = computed(() => {
    if (new_poster.value) return false
    return stroke_pref.value
  })
  const show_fill = computed(() => {
    if (new_poster.value) return true
    return fill_pref.value
  })
  const path = ref(null)
  const fill = ref(undefined)
  const stroke = ref(undefined)
  const d = ref(undefined)
  const stroke_opacity = ref('0.90')
  const stroke_width = ref('0.33')
  const path_length = ref(0)

  mounted(async () => {
    fill.value = props.fill
    stroke.value = props.stroke
    d.value = props.path.getAttribute('d')
    if (props.path.style.color) stroke.value = props.path.style.color
    if (props.path.style.fill) fill.value = props.path.style.fill
    await tick()
    if (path.value) path_length.value = path.value.getTotalLength()
  })
  watch_effect(() => (d.value = props.path?.getAttribute('d')))
</script>

<template>
  <g>
    <path
      :id="props.id"
      ref="path"
      :d="d"
      :mask="props.mask"
      :itemprop="props.itemprop"
      :fill="show_fill ? fill : 'none'"
      :fill-opacity="show_fill ? '0.90' : undefined"
      :fill-rule="show_fill ? 'evenodd' : undefined" />
    <use
      :href="`#${props.id}`"
      fill="none"
      :stroke="stroke"
      :stroke-opacity="show_stroke ? stroke_opacity : '0'"
      :stroke-width="stroke_width" />
  </g>
</template>

<style>
  path[itemprop] {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    transition: stroke-opacity 0.15s ease;
    &:focus {
      outline: none;
    }
    &:active {
      fill-opacity: 0.99;
    }
  }
  use {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    transition: stroke-opacity 0.15s ease;
  }
</style>
