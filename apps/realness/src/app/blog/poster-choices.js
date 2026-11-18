/**
 * The posters a person may put on an article: their own newest posters, each
 * with the drawing itself so the choice is made by looking.
 */

/** How many posters the panel offers at once. */
export const CHOICE_LIMIT = 24

/**
 * One choice per poster that loads; a poster that cannot load is left out.
 * @param {{ id: string }[]} posters newest first
 * @param {(id: string) => Promise<{ svg?: Element | null } | null>} load
 * @returns {Promise<{ id: string, svg: Element }[]>}
 */
export const poster_choices = async (posters, load) => {
  const wanted = posters.slice(0, CHOICE_LIMIT)
  const items = await Promise.all(
    wanted.map(poster => load(poster.id).catch(() => null))
  )
  return wanted.flatMap((poster, index) => {
    const svg = items[index]?.svg
    return svg ? [{ id: poster.id, svg }] : []
  })
}
