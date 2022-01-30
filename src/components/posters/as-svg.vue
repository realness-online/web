<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import { onMounted, ref } from 'vue'
  import { as_type } from '@/use/itemid'
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
    toggle_aspect: {
      type: Boolean,
      required: false,
      default: true
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
    },
    as_stroke: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const {
    id,
    viewbox,
    aspect_ratio,
    click,
    working,
    show,
    should_show,
    focus,
    focusable,
    tabindex,
    vector
  } = as_poster(props, emit)
  const trigger = ref(null)
  use_intersect(
    trigger,
    ([{ isIntersecting }]) => {
      if (isIntersecting) show()
    },
    { rootMargin: '132px' }
  )
  onMounted(should_show)
</script>
<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="id"
    itemscope
    :itemtype="`/${as_type(itemid)}`"
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
<style lang="stylus">
  svg[itemtype="/posters"]
  svg[itemtype="/avatars"]
    mix-blend-mode: difference
    aspect-ratio: 16 / 9
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    &::focus
      border: 2px solid red
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
    & > path
      &:active
        fill: yellow
      &:focus
        outline: none
        stroke-width: 3px
        stroke: white
</style>
