/**
 * e12: a branch reads the parent past its anchor, on purpose. The read is an
 * ordinary storage scan: the parent's line is already committed, so no watch,
 * no network, and no liveness on the parent's side is involved.
 *
 * Reading does not adopt. The entries arrive as text the branch can show; they
 * enter the branch's model context only when the branch appends a summary.
 */

/** One page is enough for "what was said"; a longer parent reads again. */
const PARENT_PAGE = 200

/**
 * The parent's entries after the branch's anchor, oldest first.
 * @param {{ scanEntries: (query: object, limit: number, cursor: unknown, context: unknown) => Promise<{ items: unknown[] }> }} storage
 * @param {{ parent: number, anchor: number }} divergence
 * @param {unknown} context
 * @param {number} [limit]
 */
export const read_parent_past = async (
  storage,
  divergence,
  context,
  limit = PARENT_PAGE
) => {
  if (!divergence.forked) return []
  const page = await storage.scanEntries(
    {
      conversationId: divergence.parent,
      minEntryId: divergence.anchor + 1,
      order: 'ascending'
    },
    limit,
    undefined,
    context
  )
  return page.items
}

/**
 * What the branch can say about the parent after one read.
 * @param {readonly { id: number }[]} entries
 * @param {{ parent: number, anchor: number }} divergence
 */
export const describe_parent = (entries, divergence) => {
  if (!divergence.forked)
    return { count: 0, from: null, to: null, line: 'the original line' }
  if (entries.length === 0)
    return {
      count: 0,
      from: null,
      to: null,
      line: `parent ${divergence.parent} has nothing after ${divergence.anchor}`
    }
  const from = entries[0].id
  const to = entries.at(-1).id
  return {
    count: entries.length,
    from,
    to,
    line: `parent ${divergence.parent} added ${entries.length} after ${divergence.anchor}`
  }
}
