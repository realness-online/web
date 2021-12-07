<script setup>
  import { reactive } from 'vue'
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
  const background = reactive({
    style: {
      fill: 'var(--white)'
    }
  })
</script>
<template>
  <rect
    ref="background"
    itemprop="background"
    width="100%"
    height="100%"
    :style="background.style"
    :tabindex="tabindex" />
</template>
