/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

import { poster_landscape } from '@/use/poster-aspect'
import { as_created_at } from '@/utils/itemid'

// Open Graph's 1.91:1 frame. Every candidate is this size, so the width and
// height meta tags in index.html and scripts/prerender.js stay static.
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export const OG_STYLES = ['bleed', 'card']

const MARGIN = 55
const SCRIM_START = 0.34
const SCRIM_ALPHA = 0.85
const HEADLINE_SIZE = 60
const SUBHEAD_SIZE = 34
const CTA_SIZE = 34
const CTA_PADDING_X = 34
const CTA_PADDING_Y = 18
const HEADLINE_GAP = 21
const SUBHEAD_GAP = 34

/**
 * Only landscape posters survive the crop into a 1.91:1 frame with anything
 * left to look at.
 * @param {Item[]} items
 * @returns {Item[]}
 */
export const landscape_posters = items =>
  items.filter(item =>
    poster_landscape(/** @type {{ viewbox?: string }} */ (item)?.viewbox)
  )

/**
 * @param {Id} itemid
 * @param {string} style
 * @returns {string}
 */
export const candidate_filename = (itemid, style) =>
  `${as_created_at(itemid)}-${style}.jpg`

/**
 * Resolve a design-system custom property to a color canvas understands. The
 * tokens chain (`--accent` -> `--water-darken` -> oklch), so reading the
 * property directly returns another `var()`; a probe element resolves it.
 * @param {string} token
 * @returns {string}
 */
export const resolve_css_color = token => {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  const { color } = getComputedStyle(probe)
  document.body.removeChild(probe)
  return color
}

/**
 * The site's own webfaces, so a headless render matches the browser.
 * @returns {Promise<void>}
 */
export const ensure_og_fonts = async () => {
  if (!document.fonts) return
  await Promise.all([
    document.fonts.load(`bold ${HEADLINE_SIZE}px Lato`),
    document.fonts.load(`${SUBHEAD_SIZE}px Lato`)
  ])
  await document.fonts.ready
}

/**
 * Bottom-anchored headline, subhead and call-to-action pill over a scrim, drawn
 * on top of an already-rasterized poster.
 *
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctx
 * @param {{ headline: string, subhead: string, cta: string, accent: string, contrast: string }} copy
 */
export const draw_og_card = (ctx, copy) => {
  const scrim = ctx.createLinearGradient(
    0,
    OG_HEIGHT * SCRIM_START,
    0,
    OG_HEIGHT
  )
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)')
  scrim.addColorStop(1, `rgba(0, 0, 0, ${SCRIM_ALPHA})`)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const pill_height = CTA_SIZE + CTA_PADDING_Y * 2
  const pill_bottom = OG_HEIGHT - MARGIN
  const pill_top = pill_bottom - pill_height

  ctx.font = `bold ${CTA_SIZE}px Lato, sans-serif`
  const pill_width = ctx.measureText(copy.cta).width + CTA_PADDING_X * 2

  ctx.fillStyle = copy.accent
  ctx.beginPath()
  ctx.roundRect(MARGIN, pill_top, pill_width, pill_height, pill_height / 2)
  ctx.fill()

  ctx.fillStyle = copy.contrast
  ctx.textBaseline = 'middle'
  ctx.fillText(copy.cta, MARGIN + CTA_PADDING_X, pill_top + pill_height / 2)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = copy.contrast

  const subhead_baseline = pill_top - SUBHEAD_GAP
  ctx.font = `${SUBHEAD_SIZE}px Lato, sans-serif`
  ctx.fillText(copy.subhead, MARGIN, subhead_baseline)

  const headline_baseline = subhead_baseline - SUBHEAD_SIZE - HEADLINE_GAP
  ctx.font = `bold ${HEADLINE_SIZE}px Lato, sans-serif`
  ctx.fillText(copy.headline, MARGIN, headline_baseline)
}
