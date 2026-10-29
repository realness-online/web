import { onRequest as on_request } from 'firebase-functions/v2/https'
import { bucket } from '#utils/firebase.js'
import { print_rows } from '#services/print-details.js'
import { log_error } from '#utils/log.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const PREVIEW_SUFFIX = '.jpg'

/**
 * The created stamps of the author's prints, newest first. A print is a poster
 * the previews script wrote a JPEG for in the `prints/` folder: that image is
 * what a sale page and a shop tile show, so its presence puts the poster on
 * sale.
 * @param {string} author - e.g. `/+16282281824`
 * @returns {Promise<string[]>}
 */
export const print_created_stamps = async author => {
  const prefix = `prints/${author.replace(/^\//, '')}/`
  const [objects] = await bucket.getFiles({ prefix })
  return objects
    .map(object => object.name.slice(prefix.length))
    .filter(name => name.endsWith(PREVIEW_SUFFIX))
    .map(name => name.slice(0, -PREVIEW_SUFFIX.length))
    .filter(name => /^\d+$/.test(name))
    .sort((a, b) => Number(b) - Number(a))
}

const clamp_limit = value => {
  const limit = Number(value)
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export const prints_list_handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const author = process.env.PRINTS_AUTHOR
  if (!author) {
    res.status(404).json({ error: 'Prints are not for sale' })
    return
  }

  try {
    const created = (await print_created_stamps(author)).slice(
      0,
      clamp_limit(req.query?.limit)
    )
    const prints = await print_rows(author, created)
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ prints })
  } catch (error) {
    log_error('print list failed', error)
    res.status(502).json({ error: 'Prints unavailable' })
  }
}

export const prints_list = on_request({ cors: true }, prints_list_handler)
