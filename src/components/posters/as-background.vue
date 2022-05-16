<template>
  <rect
    itemprop="background"
    :fill="fill"
    width="100%"
    height="100%"
    :tabindex="tabindex" />
</template>
<script setup>
  import { use_poster, is_rect } from '@/use/vector'
  import { ref } from 'vue'
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
  const fill = ref('var(--white)')
  if (props.rect?.style.fill) fill.value = props.rect?.style.fill
</script>
<style lang="stylus">
  rect[itemprop="background"]
    outline: none
    stroke: none
    &:focus
      outline:none
</style>
