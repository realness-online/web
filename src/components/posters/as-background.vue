<script setup>
  import { use_poster, is_rect, is_url_query } from '@/use/vector'
  import { ref, onMounted as mounted } from 'vue'
  const props = defineProps({
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    fill: {
      type: String,
      required: true,
      validator: is_url_query
    },
    rect: {
      type: Object,
      required: false,
      validator: is_rect
    }
  })
  const { tabindex } = use_poster(props)
  const fill = ref(null)
  mounted(() => {
    fill.value = props.fill
    if (props.rect?.style.fill) fill.value = props.rect?.style.fill
    if (props.rect?.fill) fill.value = props.rect?.fill
  })
</script>

<template>
  <rect
    itemprop="background"
    :fill="fill"
    width="100%"
    height="100%"
    :tabindex="tabindex" />
</template>

<style lang="stylus">
  rect[itemprop="background"]
    outline: none
    stroke: none
    &:focus
      outline:none
</style>
