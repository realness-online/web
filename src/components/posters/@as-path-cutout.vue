<script setup>
  import { ref, inject, computed } from 'vue'

  /**
   * @typedef {import('@/types').Cutout} Cutout
   */

  const { cutout } = defineProps({
    cutout: {
      /** @type {import('vue').PropType<Cutout>} */
      type: Object,
      required: true,
      validator: value => {
        if (!value || typeof value !== 'object') return false
        if (typeof value.d !== 'string') return false
        if (typeof value.fill !== 'string') return false
        if (
          value.transform !== null &&
          value.transform !== undefined &&
          typeof value.transform !== 'string'
        ) {
          console.warn('Cutout transform must be a string, null, or undefined')
          return false
        }
        return true
      }
    }
  })

  const vector = inject('vector', ref(null))

  const path = ref(null)

  const d = computed(() => cutout.d)
  const fill = computed(() => cutout.fill)

  /**
   * Ensure transform is always a string or undefined
   * @returns {string | undefined}
   */
  const transform = computed(() => {
    if (vector.value?.optimized) return undefined
    if (typeof cutout.transform !== 'string' || !cutout.transform) {
      console.warn('Cutout transform must be a non-empty string')
      return undefined
    }
    return cutout.transform
  })

  const data_progress = computed(() => cutout['data-progress'] || undefined)
</script>

<template>
  <path
    ref="path"
    :d="d"
    tabindex="-1"
    fill-opacity="'0.5'"
    :fill="fill"
    :transform="transform"
    :data-progress="data_progress" />
</template>
