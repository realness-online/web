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
