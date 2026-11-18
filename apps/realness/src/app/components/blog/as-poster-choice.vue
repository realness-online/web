<script setup>
  import { onMounted as mounted, ref } from 'vue'

  const props = defineProps({
    svg: { type: Object, required: true }
  })

  const box = ref(null)

  mounted(() => box.value?.append(props.svg.cloneNode(true)))
</script>

<template>
  <span ref="box" aria-hidden="true" />
</template>

<style lang="stylus">
  span[aria-hidden='true'] > svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }
</style>
