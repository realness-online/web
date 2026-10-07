import { geology_layers } from '@/use/poster'
import { as_layer_id } from '@/utils/itemid'
import { report_symbol_ready, is_symbol_ready } from '@/use/symbol-ready'

/**
 * Say the cutout symbols for a poster have loaded.
 *
 * as-svg draws a cutout only once the symbol it points at holds geometry, and
 * the symbols live in as-poster-symbol - a sibling that a shallow mount of
 * as-svg never renders. Without this the layers are correctly absent, which is
 * not what a test about them is asking.
 *
 * @param {string} itemid The poster
 * @param {boolean} [loaded]
 */
export const load_cutout_symbols = (itemid, loaded = true) => {
  for (const layer of geology_layers) {
    const layer_id = as_layer_id(
      /** @type {import('@/types').Id} */ (itemid),
      layer
    )
    // The registry counts owners, so say the state outright rather than
    // nudging it - a test does not want to inherit the last test's count.
    while (is_symbol_ready(layer_id)) report_symbol_ready(layer_id, false)
    if (loaded) report_symbol_ready(layer_id, true)
  }
}
