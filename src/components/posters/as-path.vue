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
    },
    visible: {
      type: Boolean,
      required: false,
      default: true
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
  <path
    :id="props.id"
    ref="path"
    :d="d"
    :mask="props.mask"
    :itemprop="props.itemprop"
    :tabindex="props.tabindex"
    :fill="show_fill ? fill : 'none'"
    :fill-opacity="show_fill ? '0.90' : undefined"
    :fill-rule="show_fill ? 'evenodd' : undefined" />
  <use
    :href="`#${props.id}`"
    fill="none"
    :stroke="stroke"
    :stroke-opacity="stroke_opacity"
    :stroke-width="stroke_width"
    :style="{
      opacity: show_stroke ? 1 : 0,
      visibility: show_stroke ? 'visible' : 'hidden'
    }" />
</template>

<style>
  use[fill='none'] {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease,
      stroke-opacity 0.2s ease;
    @starting-style {
      opacity: 0;
    }
  }
  path[itemprop] {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    &:focus {
      outline: none;
    }
    &:active {
      fill-opacity: 0.99;
    }
  }
  g {
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease;
    @starting-style {
      opacity: 0;
    }
  }
</style>
