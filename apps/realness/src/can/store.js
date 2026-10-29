import { gz_keys } from './gz-keys.js'
import { layout } from './layout.js'

/**
 * A store as every server sees it: keys by name, files as `name.gz`, grouped
 * under people and `server/`. Wrap each adapter once, where it is opened.
 * @template S
 * @param {S} adapter
 * @returns {S}
 */
export const store_of = adapter => layout(gz_keys(/** @type {any} */ (adapter)))
