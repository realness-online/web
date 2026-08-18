<script setup>
  /** @typedef {import('@/types').Id} Id */
  import { computed } from 'vue'
  import AsSymbol from '@/components/posters/as-symbol'
  import AsSymbolShadow from '@/components/posters/as-symbol-shadow'
  import { as_layer_id } from '@/utils/itemid'
  import { geology_layers } from '@/use/poster'
  import { use_deferred_unmount } from '@/use/deferred-unmount'
  import { mosaic } from '@/utils/preference'

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

  /**
   * Every cutout the poster has, not only the ones switched on.
   *
   * A symbol reads its geometry out of idb when it mounts, so tying the defs
   * to the preferences put that read on the key press: the layer sat still for
   * as long as the read took, then faded. Same press, different wait each
   * time. Defs are not drawn - only the `use` in as-svg draws - so keeping
   * them resident costs nothing on screen and makes every press immediate.
   * The default has all five on anyway, so this is the DOM the app already
   * carries.
   */
  const defined_layers = computed(() => {
    if (!layer_defs_on.value) return []
    // Coarsest first, as the defs were written by hand before this loop.
    return [...geology_layers]
      .reverse()
      .filter(layer => props.vector?.cutouts?.[layer])
  })

  // The defs have to outlive the mosaic switch by as long as the `use` does.
  // If a symbol goes first the `use` resolves to nothing and the layer blanks,
  // so the exit transition over in as-svg never gets to run.
  const { keys: held_layers } = use_deferred_unmount(
    () => defined_layers.value,
    { steps: geology_layers.length - 1 }
  )
</script>

<template>
  <svg v-if="shown" data-poster-symbol-defs aria-hidden="true" hidden>
    <defs>
      <as-symbol-shadow />
      <as-symbol
        v-for="layer in held_layers"
        :key="as_layer_id(/** @type {Id} */ (itemid), layer)"
        :itemid="as_layer_id(/** @type {Id} */ (itemid), layer)" />
    </defs>
  </svg>
</template>
