<script setup>
  import { use as use_poster, is_rect, is_url_query } from '@/use/poster'
  import { ref, onMounted as mounted, computed } from 'vue'
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
    },
    visible: {
      type: Boolean,
      required: false,
      default: true
    }
  })
  const { tabindex } = use_poster(props)
  const fill = ref(null)
  mounted(() => {
    fill.value = props.fill
    if (props.rect?.style.fill) fill.value = props.rect?.style.fill
    if (props.rect?.fill) fill.value = props.rect?.fill
  })
  const style = computed(() => ({
    opacity: props.visible ? 1 : 0,
    visibility: props.visible ? 'visible' : 'hidden'
  }))
</script>

<template>
  <rect
    itemprop="background"
    :fill="fill"
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
      opacity 0.75s ease,
      visibility 0.75s ease
    @starting-style
      opacity: 0
    &:focus
      outline:none
</style>
