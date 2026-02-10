its
<script setup>
  /* eslint-disable vue/no-static-inline-styles */
  /** @typedef {import('@/types').Id} Id */
  import AsSymbol from '@/components/posters/as-symbol'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  import { as_layer_id } from '@/utils/itemid'
  import {
    cutout,
    boulders,
    rocks,
    gravel,
    sand,
    sediment
  } from '@/utils/preference'

  defineProps({
    itemid: {
      type: String,
      required: true
    },
    vector: {
      type: Object,
      default: null
    },
    shown: {
      type: Boolean,
      default: false
    }
  })
</script>

<template>
  <svg v-if="shown" style="display: none">
    <as-symbol-shadow />
    <as-symbol
      v-if="cutout && boulders && vector?.cutouts?.boulders"
      :itemid="as_layer_id(/** @type {Id} */ (itemid), 'boulders')" />
    <as-symbol
      v-if="cutout && rocks && vector?.cutouts?.rocks"
      :itemid="as_layer_id(/** @type {Id} */ (itemid), 'rocks')" />
    <as-symbol
      v-if="cutout && gravel && vector?.cutouts?.gravel"
      :itemid="as_layer_id(/** @type {Id} */ (itemid), 'gravel')" />
    <as-symbol
      v-if="cutout && sand && vector?.cutouts?.sand"
      :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sand')" />
    <as-symbol
      v-if="cutout && sediment && vector?.cutouts?.sediment"
      :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sediment')" />
  </svg>
</template>
