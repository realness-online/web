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
    <as-background
      :rect="vector.background"
      :tabable="tabable"
      @focus="focus('background')" />
    <as-path
      v-if="vector.light"
      :path="vector.light"
      itemprop="light"
      :tabindex="tabindex"
      @focus="focus('light')" />
    <as-path
      v-if="vector.regular"
      :path="vector.regular"
      itemprop="regular"
      :tabindex="tabindex"
      @focus="focus('regular')" />
    <as-path
      :path="vector.bold"
      itemprop="bold"
      :tabindex="tabindex"
      @focus="focus('bold')" />
  </svg>
</template>
<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import { onMounted } from 'vue'
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
    focusable,
    tabindex,
    vector
  } = as_poster(props, emit)
  onMounted(should_show)
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
    aspect-ratio: 16 / 9
    aspect-ratio: 1 / 1
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    &::focus
      border: 2px solid red

    & > rect[itemprop]
    & > path[itemprop]
      stroke: black-background
      stroke-width: 1px
      stroke-opacity: 0.5
      outline: none
    & > path[itemprop="light"]
        fill: inherit
    & > path[itemprop="regular"]
        fill: inherit
    & > path[itemprop="bold"]
        stroke: white
        stroke-opacity: 0.75
      &:focus
        outline: none
        stroke: red
        animation-name: press
      &:active
        outline: none
        stroke: red
        animation-name: press
</style>
