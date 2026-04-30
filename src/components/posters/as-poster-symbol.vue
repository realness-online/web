<script setup>
  /** @typedef {import('@/types').Id} Id */
  import { computed } from 'vue'
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

  const props = defineProps({
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
    },
    /** When set, overrides mosaic for whether cutout symbols are defined. */
    show_cutout_symbols: {
      type: Boolean,
      default: undefined
    }
  })

  const layer_defs_on = computed(() =>
    props.show_cutout_symbols !== undefined
      ? props.show_cutout_symbols
      : mosaic.value
  )
</script>

<template>
  <svg v-if="shown" data-poster-symbol-defs aria-hidden="true" hidden>
    <defs>
      <as-symbol-shadow />
      <as-symbol
        v-if="layer_defs_on && boulders && vector?.cutouts?.boulders"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'boulders')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'boulders')" />
      <as-symbol
        v-if="layer_defs_on && rocks && vector?.cutouts?.rocks"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'rocks')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'rocks')" />
      <as-symbol
        v-if="layer_defs_on && gravel && vector?.cutouts?.gravel"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'gravel')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'gravel')" />
      <as-symbol
        v-if="layer_defs_on && sand && vector?.cutouts?.sand"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'sand')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sand')" />
      <as-symbol
        v-if="layer_defs_on && sediment && vector?.cutouts?.sediment"
        :key="as_layer_id(/** @type {Id} */ (itemid), 'sediment')"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), 'sediment')" />
    </defs>
  </svg>
</template>
