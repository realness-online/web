<template>
  <icon v-if="working" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="id"
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    @click="click">
    <rect
      itemprop="background"
      width="100%"
      height="100%"
      :tabindex="tabindex"
      @focus="focus('background')" />
    <path itemprop="bold" :tabindex="tabindex" @focus="focus('bold')" />
    <path itemprop="regular" :tabindex="tabindex" @focus="focus('regular')" />
    <path itemprop="light" :tabindex="tabindex" @focus="focus('light')" />
  </svg>
</template>
<script setup>
  import { defineProps, defineEmits, watch, computed } from 'vue'
  import {
    as_poster,
    is_vector,
    is_vector_id,
    is_focus_path
  } from '@/use/vector'
  import icon from '@/components/icon'

  const emit = defineEmits({ focus: is_focus_path })
  const props = defineProps({
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    poster: {
      type: Object,
      required: false,
      default: null,
      validator: is_vector
    }
  })
  const { id, itemid, viewbox, aspect_ratio, click, vector } = as_poster()
  const tabindex = computed(() => {
    if (props.tabable) return 0
    else return undefined
  })
  const focusable = computed(() => {
    if (!props.tabable) return 0
    else return undefined
  })
  const focus = async layer => {
    emit('focus', layer)
  }
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
    aspect-ratio: 16 / 9
    aspect-ratio: 1 / 1
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    &:focus
      border:2px solid red
    & svg:focus
      fill: white
    & > use
      stroke: black-background
      stroke-width: 1px
      stroke-opacity: 0.5
      outline: none
      &:focus
        animation-name: press
      &:active
        stroke: white
        fill: red
        animation-name: press-hold
</style>
