<template>
  <defs>
    <filter id="emboss">
      <feConvolveMatrix
        kernelMatrix="2 0 0
                      0 0 0
                      0 0 -2" />
    </filter>
  </defs>
  <use tabindex="-1" class="emboss" opacity=".66"  :href="fragment('light')" filter="url(#emboss)" />
</template>
<script setup>
  import { as_fragment_id, as_query_id } from '@/use/itemid'
  import { is_vector } from '@/use/vector'
  const props = defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const query = add => `${as_query_id(props.vector.id)}-${add}`
  const fragment = add => `${as_fragment_id(props.vector.id)}-${add}`
</script>
