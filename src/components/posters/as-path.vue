<script setup>
  import { ref, watch, inject } from 'vue'
  import { is_path } from '@/use/vector'
  const path = ref(null)
  const props = defineProps({
    path: {
      type: Object,
      required: true,
      validate: is_path
    },
    tabindex: {
      type: Number,
      required: true
    }
  })
  const as_stroke = inject('as_stroke', false)
  const d = ref(props.path.getAttribute('d'))
  const style = ref(props.path.getAttribute('style'))
  const fill = ref(null)
  watch(as_stroke, () => {
    if (as_stroke.value) {
      fill.value = path.value.style.fill
      path.value.style.fill = 'hsla(0,0%,0%, 0.1)'
    } else path.value.style.fill = fill.value
  })
  watch(d, () => (d.value = props.path.getAttribute('d')))
</script>
<template>
  <path ref="path" :d="d" :tabindex="tabindex" :style="style" />
</template>
