<script setup>
  import { as_query_id, as_fragment_id } from '@/utils/itemid'
  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })
  const as_url = add => `url(${as_fragment_id(props.itemid)}-${add})`
  const query = add => {
    if (!props.itemid) return add
    if (add) return `${as_query_id(props.itemid)}-${add}`
    return as_query_id(props.itemid)
  }
</script>

<template>
  <g class="masks">
    <mask
      :id="query('horizontal-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect
        width="100%"
        height="100%"
        :fill="as_url('horizontal-background')" />
    </mask>
    <mask
      :id="query('radial-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect width="100%" height="100%" :fill="as_url('radial-background')" />
    </mask>
    <mask
      :id="query('vertical-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect width="100%" height="100%" :fill="as_url('vertical-background')" />
    </mask>
  </g>
</template>
