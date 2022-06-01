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
    fill="gray"
    filter="url(#emboss)" />
  <use
    class="emboss bold"
    tabindex="-1"
    :href="fragment('bold')"
    fill="dimgray"
    filter="url(#emboss)" />
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
    return `${as_fragment_id(props.vector.value.id)}-${add}`
  }
</script>
