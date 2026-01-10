<script setup>
  import { ref, inject } from 'vue'

  defineProps({
    geology: {
      type: String,
      required: true,
      validator: value =>
        typeof value === 'string' &&
        ['sediment', 'sand', 'gravel', 'rocks', 'boulders'].includes(value)
    }
  })
  const vector = inject('vector', ref(null))
</script>

<template>
  <defs>
    <component :is="vector[geology]" v-if="vector[geology]" />
  </defs>
  <use :href="`#${vector.id}-${geology}`" />
</template>
