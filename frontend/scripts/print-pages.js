import { site_name } from '../src/prerender/pages.js'

/** A date's calendar part: `2026-09-22T02:42:22Z` reads as `2026-09-22`. */
const DAY_LENGTH = 10

/**
 * The sale line a print page describes itself with, worded the same way the
 * server-rendered share page words it.
 * @param {unknown} dates
 * @returns {string}
 */
export const sale_line = dates => {
  if (!Array.isArray(dates) || !dates.length) return 'No sales recorded yet.'
  const days = dates.map(date => String(date).slice(0, DAY_LENGTH))
  return `Recorded sale ${days.length === 1 ? 'date' : 'dates'}: ${days.join(', ')}`
}

/**
 * One prerendered page per print the shop lists. Everything a link preview
 * needs is here: its own address, the thought, the sale line, and the poster's
 * preview image when the shop has one.
 * @param {unknown} payload - the `prints-list` body
 * @returns {Array<{ path: string, title: string, description: string, og_title: string, og_image?: string }>}
 */
export const print_pages_from_list = payload => {
  const prints =
    payload && typeof payload === 'object' && Array.isArray(payload.prints)
      ? payload.prints
      : []
  return prints
    .filter(print => print && /^\d+$/.test(String(print.id ?? '')))
    .map(print => {
      const title = `Hand-finished print - ${site_name}`
      const description = [print.thought, sale_line(print.dates)]
        .filter(Boolean)
        .join(' - ')
      return {
        path: `/prints/${print.id}`,
        title,
        description,
        og_title: title,
        ...(typeof print.image === 'string' && print.image
          ? {
              og_image: print.image,
              og_image_alt: 'Hand-finished Realness print',
              og_image_type: 'image/png'
            }
          : {})
      }
    })
}

/**
 * The print pages for this build, or none when the shop cannot be reached. A
 * build must not fail over a list a later deploy can fill in.
 * @param {string | undefined} url
 * @param {typeof fetch} [fetch_json]
 * @param {(message: string) => void} [log]
 * @returns {Promise<ReturnType<typeof print_pages_from_list>>}
 */
export const fetch_print_pages = async (
  url,
  fetch_json = fetch,
  log = console.warn
) => {
  if (!url) return []
  try {
    const response = await fetch_json(url)
    if (!response.ok) throw new Error(`prints list answered ${response.status}`)
    return print_pages_from_list(await response.json())
  } catch (error) {
    log(`prerender: no print pages (${error.message})`)
    return []
  }
}
