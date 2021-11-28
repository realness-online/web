<script setup>
  import { ref } from 'vue'
  import { is_path } from '@/use/vector'
  const props = defineProps({
    path: {
      type: Object,
      required: true,
      validate: is_path
    }
  })
  const vector = ref(props.path.getAttribute('d'))
  const style = {
    fill: props.path.getAttribute('fill'),
    'fill-opacity': props.path.getAttribute('fill-opacity'),
    'fill-rule': 'evenodd'
  }
</script>

<template>
  <path ref="path" :style="style" :d="vector" />
</template>
