import { load_from_cache } from '@/utils/itemid'
import { poster_landscape } from '@/use/poster-aspect'

/**
 * @param {import('@/types').Item[]} posters
 * @returns {Promise<{ poster: import('@/types').Item, landscape: boolean }[]>}
 */
const tag_poster_orientations = posters =>
  Promise.all(
    posters.map(async poster => {
      const { item } = await load_from_cache(
        /** @type {import('@/types').Id} */ (poster.id)
      )
      const viewbox = /** @type {{viewbox?: string} | null} */ (item)?.viewbox
      return { poster, landscape: poster_landscape(viewbox) }
    })
  )

/**
 * Pick gallery landscape/portrait counts so featured + gallery totals match.
 *
 * @param {{ landscape: number, portrait: number }} featured
 * @param {{ landscape: number, portrait: number }} pool
 * @returns {{ landscape: number, portrait: number }}
 */
export const gallery_counts_for_page_balance = (featured, pool) => {
  const diff = featured.portrait - featured.landscape
  let portrait_count = Math.min(
    pool.portrait,
    Math.max(0, pool.landscape - diff)
  )
  let landscape_count = Math.min(pool.landscape, portrait_count + diff)

  if (landscape_count < 0) {
    landscape_count = 0
    portrait_count = Math.min(pool.portrait, -diff)
  } else if (landscape_count !== portrait_count + diff) {
    portrait_count = landscape_count - diff
    portrait_count = Math.max(0, Math.min(pool.portrait, portrait_count))
  }

  return { landscape: landscape_count, portrait: portrait_count }
}

/**
 * @param {{ landscape: number, portrait: number }} counts
 * @param {number} max
 * @returns {{ landscape: number, portrait: number }}
 */
export const cap_gallery_counts = (counts, max) => {
  let { landscape, portrait } = counts
  while (landscape + portrait > max)
    if (landscape >= portrait && landscape > 0) landscape--
    else if (portrait > 0) portrait--
    else break

  return { landscape, portrait }
}

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
 * @param {{ featured?: import('@/types').Item[], max?: number }} [options]
 * @returns {Promise<import('@/types').Item[]>}
 */
export const balance_gallery_posters = async (
  posters,
  { featured = [], max = Infinity } = {}
) => {
  if (!posters.length) return posters

  const [featured_tagged, gallery_tagged] = await Promise.all([
    tag_poster_orientations(featured),
    tag_poster_orientations(posters)
  ])

  const featured_counts = {
    landscape: featured_tagged.filter(entry => entry.landscape).length,
    portrait: featured_tagged.filter(entry => !entry.landscape).length
  }

  const landscape_pool = gallery_tagged.filter(entry => entry.landscape)
  const portrait_pool = gallery_tagged.filter(entry => !entry.landscape)

  const counts = cap_gallery_counts(
    gallery_counts_for_page_balance(featured_counts, {
      landscape: landscape_pool.length,
      portrait: portrait_pool.length
    }),
    max
  )

  const selected = [
    ...landscape_pool.slice(0, counts.landscape),
    ...portrait_pool.slice(0, counts.portrait)
  ]

  if (selected.length < 2) return selected.map(entry => entry.poster)

  return balance_orientation(selected, entry => entry.landscape).map(
    entry => entry.poster
  )
}
