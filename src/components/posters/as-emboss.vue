<template>
  <use
    class="emboss light"
    tabindex="-1"
    :href="fragment('light')"
    fill="gray"
    filter="url(#emboss)" />
  <use
    class="emboss regular"
    tabindex="-1"
    :href="fragment('regular')"
    fill="DimGray"
    filter="url(#emboss)" />
  <use
    class="emboss bold"
    tabindex="-1"
    :href="fragment('bold')"
    fill="gray"
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
  // svg > use.emboss.regular
  //   opacity: 0.5
  //   visibility: hidden
  //   transition-delay: 0s, 0.5s
  // svg:focus > use.emboss
  //   opacity: 1
  //   visibility: visible;
</style>
