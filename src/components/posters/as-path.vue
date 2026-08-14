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
  import {
    stroke as stroke_pref,
    shadow as shadow_pref,
    mosaic as mosaic_pref
  } from '@/utils/preference'
  import css_var from '@/utils/css-var'
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
    return shadow_pref.value
  })
  // Named apart from the props of the same name: `<script setup>` bindings
  // shadow props in the template, so `fill` would quietly mean two things.
  const path_element = ref(null)
  const fill_color = ref(undefined)
  const stroke_color = ref(undefined)
  const d = ref(undefined)
  const stroke_opacity = ref('0.90')
  const stroke_width = ref('0.5')
  const path_length = ref(0)
  const stroke_dasharray = {
    light: '8, 16',
    regular: '13, 21',
    medium: '18, 26',
    bold: '4, 32'
  }
  // Per-path colors exist to separate a stroke from the shadow layer beneath
  // it. With the shadows off there is nothing to separate from, so they only
  // scatter across the lightness range and half of them vanish into the paper
  // ground. One ink for all of them instead.
  const ink_only = computed(
    () => !shadow_pref.value && !mosaic_pref.value && stroke_pref.value
  )
  const drawn_stroke = computed(() =>
    ink_only.value ? css_var('--pumice').trim() : stroke_color.value
  )
  const drawn_width = computed(() =>
    ink_only.value ? '0.5' : stroke_width.value
  )
  const path_style = computed(() => ({
    opacity: props.visible ? 1 : 0,
    visibility: props.visible ? 'visible' : 'hidden'
  }))

  mounted(async () => {
    fill_color.value = props.fill
    stroke_color.value = props.stroke
    d.value = props.path.getAttribute('d')
    if (props.path.style.color) stroke_color.value = props.path.style.color
    if (props.path.style.fill) fill_color.value = props.path.style.fill
    await tick()
    if (path_element.value)
      path_length.value = path_element.value.getTotalLength()
  })
  watch_effect(() => {
    d.value = props.path?.getAttribute('d')
  })

  watch_effect(() => {
    if (props.fill && props.fill !== fill_color.value)
      fill_color.value = props.fill
  })
</script>

<template>
  <path
    :id="props.id"
    ref="path_element"
    :d="d"
    :mask="props.mask"
    :itemprop="props.itemprop"
    :tabindex="props.tabindex"
    :fill="show_fill ? fill_color : 'none'"
    :fill-opacity="show_fill ? '0.90' : undefined"
    :fill-rule="show_fill ? 'evenodd' : undefined"
    :stroke="drawn_stroke"
    :stroke-opacity="show_stroke && props.visible ? stroke_opacity : 0"
    :stroke-width="show_stroke && props.visible ? drawn_width : 0"
    stroke-dashoffset="0"
    :stroke-dasharray="stroke_dasharray[props.itemprop]"
    :style="path_style" />
</template>

<style>
  path[itemprop] {
    stroke-miterlimit: 3.14;
    stroke-linecap: round;
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease,
      stroke-opacity 0.2s ease,
      stroke-width 0.2s ease;
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
  }

  @starting-style {
    path[itemprop] {
      opacity: 0;
    }
  }

  @starting-style {
    g {
      opacity: 0;
    }
  }
</style>
