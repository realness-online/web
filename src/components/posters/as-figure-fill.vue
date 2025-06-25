<script setup>
  import AsSvg from '@/components/posters/as-svg'
  import { ref } from 'vue'
  import { is_vector_id, is_vector } from '@/use/poster'
  const props = defineProps({
    itemid: {
      required: true,
      type: String,
      validator: is_vector_id
    }
  })
  const emit = defineEmits({ toggle: () => true, show: is_vector })
  const figure = ref(null)

</script>

<template>
  <figure id="edit-fill" ref="figure">
    <as-svg
      :itemid="itemid"
      :optimize="true"
      :slice="true"
      :tabable="true"
      tabindex="-1"/>
  </figure>
</template>

<style lang="stylus">
  figure#edit-fill > svg
    position: fixed
    z-index: 0
    top: 0
    bottom: 0
    left: 0
    right: 0
    @media (orientation: landscape) and (max-height: page-width)
      max-height: 100dvh
      min-height: inherit
</style>
