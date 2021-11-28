<script setup>
  import { reactive } from 'vue'
  import { as_poster, is_vector } from '@/use/vector'
  const emit = defineEmits(['focus'])
  const props = defineProps({
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    rect: {
      type: Object,
      required: false,
      validator: is_vector
    }
  })
  const { tabindex } = as_poster(props, emit)
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
    :tabindex="tabindex"
    @focus="emit('focus')" />
</template>
