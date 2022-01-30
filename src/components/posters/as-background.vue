<script setup>
  import { as_poster, is_rect } from '@/use/vector'
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
  const { tabindex } = as_poster(props)
  let style = {}
  if (props.rect) style = props.rect.getAttribute('style')
</script>
<template>
  <rect
    itemprop="background"
    :style="style"
    width="100%"
    height="100%"
    fill="white"
    :tabindex="tabindex" />
</template>
<style lang="stylus">
  rect[itemprop="background"]
    fill: var(--white-poster)
    &:focus
      outline: none
      stroke: none
      animation-name: press
</style>
