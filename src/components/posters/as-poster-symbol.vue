<script setup>
  /* eslint-disable vue/no-static-inline-styles */
  /** @typedef {import('@/types').Id} Id */
  import AsSymbol from '@/components/posters/as-symbol'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  import { as_layer_id } from '@/utils/itemid'
  import {
    mosaic,
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
  <svg v-if="shown" style="display: none; visibility: hidden">
    <defs>
      <as-symbol-shadow />
      <as-symbol
        v-if="mosaic && boulders && vector?.cutouts?.boulders"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'boulders')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'boulders')" />
      <as-symbol
        v-if="mosaic && rocks && vector?.cutouts?.rocks"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'rocks')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'rocks')" />
      <as-symbol
        v-if="mosaic && gravel && vector?.cutouts?.gravel"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'gravel')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'gravel')" />
      <as-symbol
        v-if="mosaic && sand && vector?.cutouts?.sand"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'sand')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sand')" />
      <as-symbol
        v-if="mosaic && sediment && vector?.cutouts?.sediment"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'sediment')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sediment')" />
    </defs>
  </svg>
</template>
