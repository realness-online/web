<template>
  <svg
    class="emboss"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="-1">
    <defs>
      <filter id="emboss">
        <feConvolveMatrix
          kernelMatrix="3 0 0
                        0 0 0
                        0 0 -3" />
      </filter>
    </defs>
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
      fill="gray"
      filter="url(#emboss)" />
    <use
      class="emboss bold"
      tabindex="-1"
      :href="fragment('bold')"
      fill="dimgray"
      filter="url(#emboss)" />
  </svg>
</template>
<script setup>
  import { is_vector_id } from '@/use/vector'
  import { use_poster } from '@/use/vector'
  const { fragment, viewbox, aspect_ratio, show } = use_poster()
  defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })
  const query = add => `${as_query_id(props.vector.id)}-${add}`
  const fragment = add => `${as_fragment_id(props.vector.id)}-${add}`
</script>
<style lang="stylus">
  svg.emboss
    aspect-ratio: 16/9;
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    outline: none;
</style>
