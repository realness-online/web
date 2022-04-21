<template>
  <use
    class="emboss"
    tabindex="-1"
    :href="fragment('light')"
    :fill="`url(${fragment('light-gradient')}`"
    filter="url(#emboss)" />
  <use
    class="emboss"
    tabindex="-1"
    :href="fragment('regular')"
    :fill="`url(${fragment('regular-gradient')}`"
    filter="url(#emboss)" />
  <use
    class="emboss"
    tabindex="-1"
    :href="fragment('bold')"
    :fill="`url(${fragment('light-gradient')}`"
    filter="url(#emboss)" />
</template>
<script setup>
  import { as_fragment_id } from '@/use/itemid'
  import { is_vector_id } from '@/use/vector'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })
  const fragment = add => {
    return `${as_fragment_id(props.itemid)}-${add}`
  }
</script>
<style lang="stylus">
  // svg > use.emboss
  //   opacity: 0
  //   visibility: hidden
  //   transition-delay: 0s, 0.5s
  // svg:focus > use.emboss
  //   opacity: 1
  //   visibility: visible;
</style>
