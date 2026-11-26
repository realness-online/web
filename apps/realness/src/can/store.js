import { gz_keys } from './gz-keys.js'
import { layout } from './layout.js'
import { marked } from './marks.js'

/**
 * A store as every server sees it: keys by name, files as `name.gz`, grouped
 * under people and `server/`. Wrap each adapter once, where it is opened.
 * A bucket store passes `{ marks: true }` to keep each person's hash page;
 * a disk store never does.
 * @template S
 * @param {S} adapter
 * @param {{ marks?: boolean, wait?: number }} [options]
 * @returns {S}
 */
export const store_of = (adapter, { marks = false, wait } = {}) => {
  const shaped = /** @type {any} */ (
    layout(gz_keys(/** @type {any} */ (adapter)))
  )
  return marks ? marked(shaped, { wait }) : shaped
}
