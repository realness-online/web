<script setup>
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    inject
  } from 'vue'

  const props = defineProps({
    cutout: {
      type: Object,
      required: true
    }
  })

  const vector = inject('vector', ref(null))

  const path = ref(null)
  const d = ref(undefined)
  const fill = ref(undefined)
  const fill_opacity = ref('0.5')
  const transform = ref(undefined)
  const data_progress = ref(undefined)

  mounted(() => {
    if (props.cutout && typeof props.cutout.getAttribute === 'function') {
      d.value = props.cutout.getAttribute('d')
      fill.value = props.cutout.getAttribute('fill')
      fill_opacity.value = props.cutout.getAttribute('fill-opacity') || '0.5'

      transform.value = props.cutout.getAttribute('transform')
      data_progress.value = props.cutout.dataset.progress || 0
    }
  })

  watch_effect(() => {
    if (props.cutout && typeof props.cutout.getAttribute === 'function')
      d.value = props.cutout.getAttribute('d')
  })
  watch_effect(() => {
    if (vector.value?.optimized) transform.value = undefined
  })
</script>

<template>
  <path
    ref="path"
    :d="d"
    itemprop="cutout"
    tabindex="-1"
    :fill="fill"
    :transform="transform"
    :data-progress="data_progress" />
</template>
