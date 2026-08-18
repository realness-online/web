import { reactive } from 'vue'

/**
 * Which cutout symbols have their geometry in hand.
 *
 * A `<use>` starts its fade the moment it mounts, while the `<symbol>` it
 * points at fills in from idb a frame or several later - two clocks, so the
 * layer arrived partway through its own fade, and how far through depended on
 * how fast the read was. Sometimes cinematic, sometimes a pop. The `use` waits
 * for this instead of for its own mount.
 *
 * Counted, not a flag: the same poster can be on screen more than once - a
 * feed and an avatar, a pin and its listing - and each copy loads its own
 * symbol. With a flag the first copy to leave would blank the layer for every
 * copy that stayed.
 *
 * @type {Map<string, number>}
 */
const owners = reactive(new Map())

/**
 * @param {string} itemid The layer's own id, e.g. `<poster>/rocks`
 * @param {boolean} ready
 */
export const report_symbol_ready = (itemid, ready) => {
  if (!itemid) return
  const count = owners.get(itemid) || 0
  if (ready) owners.set(itemid, count + 1)
  else if (count > 1) owners.set(itemid, count - 1)
  else owners.delete(itemid)
}

/**
 * @param {string} itemid
 * @returns {boolean}
 */
export const is_symbol_ready = itemid => owners.has(itemid)
