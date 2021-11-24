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
  import { onMounted, onUpdated } from 'vue'
  import {
    as_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/vector'
  import icon from '@/components/icon'
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
  const props = defineProps({
    immediate: {
      type: Boolean,
      required: false,
      default: false
    },
    slice: {
      type: Boolean,
      required: false,
      default: true
    },
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
  const {
    id,
    itemid,
    viewbox,
    aspect_ratio,
    click,
    working,
    should_show,
    focus,
    tabindex,
    focusable
  } = as_poster(props, emit)
  onMounted(should_show)
  onUpdated(should_show)
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
