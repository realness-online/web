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
  const d = ref(props.path.getAttribute('d'))
  const style = ref(props.path.getAttribute('style'))
</script>
<template>
  <path :d="d" :style="style" />
</template>
