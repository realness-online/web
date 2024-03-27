<template>
  <g class="masks">
    <mask
      :id="query('pattern-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <pattern
        id="pattern"
        x="0"
        y="0"
        width=".0133"
        height=".0144"
        viewBox="0 0 23.07 40">
        <path
          d="M17.62 0l-6.07 10.5m2.74 4.76L8.22 4.75m-5.48 0h12.13M.01 0h23.07M6.07 20L0 9.5m2.74-4.75l-6.07 10.5m-5.48 0H3.33m8.2 4.75L0 .02-11.54 20m40.68 0L23.07 9.5m2.74-4.75l-6.06 10.5m-5.49 0H26.4M34.6 20L23.08.02 11.53 20m-5.46 0L0 30.51m2.74 4.75l-6.07-10.5m-5.48 0H3.33m8.2-4.75L0 40l-11.54-19.98zM17.6 40l-6.06-10.5m2.74-4.76L8.2 35.25m-5.48 0h12.13M0 40h23.07L11.54 20.01m17.6 0l-6.07 10.5m2.74 4.75l-6.06-10.5m-5.49 0H26.4M11.53 20h23.08L23.07 40"
          stroke-linecap="round"
          stroke-width="3.5"
          stroke="white"
          :fill="as_url('horizontal-background')" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#pattern)" />
    </mask>
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
<script setup>
  import { as_query_id, as_fragment_id } from '@/use/itemid'
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
    else return as_query_id(props.itemid)
  }
</script>
