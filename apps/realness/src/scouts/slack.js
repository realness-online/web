/** A find worth a post scores this or more. */
const STRONG = 6

/**
 * The finds scoring {@link STRONG} or more that no post has carried yet, best
 * first.
 * @param {Record<string, string>[]} finds
 */
export const unposted_finds = finds =>
  finds
    .filter(find => !find.posted && Number(find.score) >= STRONG)
    .toSorted((a, b) => Number(b.score) - Number(a.score))

/**
 * The finds after a post: each posted one stamped with the post's date.
 * @param {Record<string, string>[]} finds
 * @param {Record<string, string>[]} posted
 * @param {string} date ISO date
 */
export const mark_posted = (finds, posted, date) => {
  const sent = new Set(posted.map(find => find.itemid))
  return finds.map(find =>
    sent.has(find.itemid) ? { ...find, posted: date } : find
  )
}

/** Slack treats these three as markup. */
const plain = (text = '') =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/**
 * The post: one line per find, or empty when there is nothing to say.
 * @param {string} label
 * @param {Record<string, string>[]} finds
 */
export const slack_text = (label, finds) =>
  finds.length
    ? [
        `*${plain(label)}* - ${finds.length} new`,
        ...finds.map(
          find =>
            `${find.score} · <${find.url}|${plain(find.org)} - ${plain(find.title)}>`
        )
      ].join('\n')
    : ''

/**
 * Send the post to a Slack incoming webhook.
 * @param {string} webhook
 * @param {string} text
 */
export const post_slack = async (webhook, text, fetcher = fetch) => {
  const response = await fetcher(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!response.ok)
    throw new Error(`Slack said ${response.status}: ${await response.text()}`)
}
