import { load_from_cache } from '@/utils/itemid'
import { poster_landscape } from '@/use/poster-aspect'

/**
 * Reorder items so landscape and portrait alternate when possible, with the
 * larger group split across the sequence instead of clustered at one end.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => boolean} is_landscape
 * @returns {T[]}
 */
export const balance_orientation = (items, is_landscape) => {
  const landscape = items.filter(is_landscape)
  const portrait = items.filter(item => !is_landscape(item))
  const ordered = []
  let land_i = 0
  let port_i = 0
  /** @type {boolean | null} */
  let last_was_landscape = null

  while (ordered.length < items.length) {
    const land_left = landscape.length - land_i
    const port_left = portrait.length - port_i
    const can_land = land_i < landscape.length
    const can_port = port_i < portrait.length

    if (!can_land) {
      ordered.push(portrait[port_i++])
      last_was_landscape = false
      continue
    }
    if (!can_port) {
      ordered.push(landscape[land_i++])
      last_was_landscape = true
      continue
    }

    let pick_landscape
    if (last_was_landscape === null) pick_landscape = land_left >= port_left
    else if (last_was_landscape) pick_landscape = false
    else pick_landscape = true

    if (pick_landscape && can_land) {
      ordered.push(landscape[land_i++])
      last_was_landscape = true
    } else {
      ordered.push(portrait[port_i++])
      last_was_landscape = false
    }
  }

  return ordered
}

/**
 * @param {import('@/types').Item[]} posters
 * @returns {Promise<import('@/types').Item[]>}
 */
export const balance_gallery_posters = async posters => {
  if (posters.length < 2) return posters

  const tagged = await Promise.all(
    posters.map(async poster => {
      const { item } = await load_from_cache(
        /** @type {import('@/types').Id} */ (poster.id)
      )
      const viewbox = /** @type {{viewbox?: string} | null} */ (item)?.viewbox
      return { poster, landscape: poster_landscape(viewbox) }
    })
  )

  return balance_orientation(tagged, entry => entry.landscape).map(
    entry => entry.poster
  )
}
