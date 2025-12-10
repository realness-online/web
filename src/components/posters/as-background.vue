<script setup>
  import { use as use_poster, is_rect, is_url_query } from '@/use/poster'
  import { ref, onMounted as mounted, computed } from 'vue'
  import {
    fill as fill_pref,
    cutout as cutout_pref,
    stroke as stroke_pref
  } from '@/utils/preference'
  const props = defineProps({
    fill: {
      type: String,
      required: true,
      validator: is_url_query
    },
    rect: {
      type: Object,
      required: false,
      validator: is_rect
    },
    visible: {
      type: Boolean,
      required: false,
      default: true
    }
  })
  const { tabindex } = use_poster(props)
  const fill_value = ref(null)
  mounted(() => {
    fill_value.value = props.fill
    if (props.rect?.style.fill) fill_value.value = props.rect?.style.fill
    if (props.rect?.fill) fill_value.value = props.rect?.fill
  })
  const background_fill = computed(() => {
    if (!fill_pref.value && !cutout_pref.value && stroke_pref.value)
      return '#808080'
    return fill_value.value
  })
  const style = computed(() => ({
    opacity: props.visible ? 1 : 0,
    visibility: props.visible ? 'visible' : 'hidden'
  }))
</script>

<template>
  <rect
    itemprop="background"
    :fill="background_fill"
    width="100%"
    height="100%"
    :tabindex="tabindex"
    :style="style" />
</template>

<style lang="stylus">
  rect[itemprop="background"]
    outline: none
    stroke: none
    transition:
      opacity 0.2s ease,
      visibility 0.2s ease
    @starting-style
      opacity: 0
    &:focus
      outline:none
</style>
