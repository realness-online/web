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
  const as_stroke = ref(inject('as_stroke', false))
  const d = ref(props.path.getAttribute('d'))
  const style = ref(props.path.getAttribute('style'))
  const fill = ref(null)
  const opacity = ref(null)
  watch(as_stroke, () => {
    if (as_stroke.value) {
      fill.value = path.value.style.fill
      opacity.value = path.value.style.fillOpacity
      path.value.style.fillOpacity = '0'
    } else {
      path.value.style.fill = fill.value
      path.value.style.fillOpacity = opacity.value
    }
  })
  watch(d, () => (d.value = props.path.getAttribute('d')))
</script>
<template>
  <path ref="path" :d="d" :tabindex="tabindex" :style="style" />
</template>
