<template>
  <rect
    itemprop="background"
    :style="style"
    width="100%"
    height="100%"
    fill="white"
    :tabindex="tabindex" />
</template>
<script setup>
  import { use_poster, is_rect } from '@/use/vector'
  const props = defineProps({
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    rect: {
      type: Object,
      required: false,
      validator: is_rect
    }
  })
  const { tabindex } = use_poster(props)
  let style = {}
  if (props.rect) style = props.rect.getAttribute('style')
</script>
<style lang="stylus">
  rect[itemprop="background"]
    outline: none
    stroke: none
    fill: var(--white-poster)
    // &:active
    //   fill: currentColor
</style>
