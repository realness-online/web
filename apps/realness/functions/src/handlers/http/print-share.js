import { onRequest as on_request } from 'firebase-functions/v2/https'
import { is_print_poster } from '#services/prints.js'
import { print_details } from '#services/print-details.js'
import { poster_file } from '#services/sale.js'
import { log_error } from '#utils/log.js'

const origin = 'https://realness.online'

const escape_html = value =>
  String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
  )

export const print_share_handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const created = (req.path ?? req.url ?? '').match(/^\/prints\/(\d+)\/?(?:\?.*)?$/)?.[1] ?? ''
  const author = process.env.PRINTS_AUTHOR
  if (!created || !author) {
    res.status(404).send('Print not found')
    return
  }
  const poster_id = `${author}/posters/${created}`
  if (!is_print_poster(poster_id, author)) {
    res.status(404).send('Print not found')
    return
  }

  try {
    const file = await poster_file(poster_id)
    if (!file) {
      res.status(404).send('Print not found')
      return
    }
    const { image, thought, dates } = await print_details(poster_id)
    const url = `${origin}/prints/${created}`
    const title = 'Hand-finished print - Realness Online'
    const sale_line = dates.length
      ? `Recorded sale ${dates.length === 1 ? 'date' : 'dates'}: ${dates.map(date => date.slice(0, 10)).join(', ')}`
      : 'No sales recorded yet.'
    const description = [thought, sale_line].filter(Boolean).join(' - ')
    const image_meta = image
      ? `<meta property="og:image" content="${escape_html(image)}" /><meta name="twitter:image" content="${escape_html(image)}" />`
      : ''
    res.set('Cache-Control', 'public, max-age=60')
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title><meta name="description" content="${escape_html(description)}" /><link rel="canonical" href="${url}" /><meta property="og:type" content="website" /><meta property="og:url" content="${url}" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${escape_html(description)}" /><meta name="twitter:card" content="summary_large_image" />${image_meta}</head><body><main><h1>Hand-finished print</h1>${image ? `<img src="${escape_html(image)}" alt="Hand-finished Realness print" style="max-width:100%;height:auto" />` : ''}${thought ? `<blockquote><p>${escape_html(thought)}</p></blockquote>` : ''}<h2>Recorded sale dates</h2>${dates.length ? `<ol>${dates.map(date => `<li><time datetime="${escape_html(date)}">${escape_html(date.slice(0, 10))}</time></li>`).join('')}</ol>` : '<p>No sales recorded yet.</p>'}<p><a href="${origin}/prints">All prints</a></p></main></body></html>`)
  } catch (error) {
    log_error('print share failed', error)
    res.status(502).send('Print unavailable')
  }
}

export const print_share = on_request(print_share_handler)
