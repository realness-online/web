<template>
  <defs>
    <filter id="emboss-light">
      <feConvolveMatrix
        kernelMatrix="2 0 0
                      0 0 0
                      0 0 -2"></feConvolveMatrix>
    </filter>
    <filter id="emboss-regular">
      <feConvolveMatrix
        kernelMatrix="4 0 0
                      0 0 0
                      0 0 -4"></feConvolveMatrix>
    </filter>
    <filter id="emboss-bold">
      <feConvolveMatrix
        kernelMatrix="19 0 0
                      0 0 0
                      0 0 -19"></feConvolveMatrix>
    </filter>
  </defs>
  <use
    class="emboss light"
    tabindex="-1"
    :href="fragment('light')"
    fill="gray"
    filter="url(#emboss-light)" />
  <use
    class="emboss regular"
    tabindex="-1"
    :href="fragment('regular')"
    fill="gray"
    filter="url(#emboss-regular)" />
  <use
    class="emboss bold"
    tabindex="-1"
    :href="fragment('bold')"
    fill="white"
    filter="url(#emboss-bold)" />
</template>
<script setup>
  import { as_fragment_id } from '@/use/itemid'
  import { is_vector } from '@/use/vector'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const fragment = add => {
    return `${as_fragment_id(props.vector.id)}-${add}`
  }
</script>
