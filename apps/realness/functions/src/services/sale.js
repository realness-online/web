import { createHash as create_hash } from 'node:crypto'
import { gzipSync as gzip_sync, unzipSync as unzip_sync } from 'node:zlib'
import { Window } from 'happy-dom'
import { bucket } from '#utils/firebase.js'
import { unique_html_files } from '#services/html-files.js'

const OPEN_ANGLE = 60

/**
 * Where a poster's html lives: `people/<author>/posters/<created>.html`,
 * or an archive folder one level deeper once the app has paged the oldest
 * posters away. The sale has to land wherever the app put the file.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @returns {Promise<import('@google-cloud/storage').File | null>}
 */
export const poster_file = async poster_id => {
  const [, author, type, created] = poster_id.split('/')
  if (!author || type !== 'posters' || !created) return null
  const prefix = `people/${author}/posters/`
  const live = bucket.file(`${prefix}${created}.html`)
  if ((await live.exists())[0]) return live

  const [files] = await bucket.getFiles({ prefix })
  const archived = unique_html_files(files).find(file =>
    file.name.endsWith(`/${created}.html`)
  )
  return archived ? bucket.file(archived.name) : null
}

/**
 * The sale record the app reads back as `item.sale`: price, date, and the
 * Stripe session that paid for it.
 * @param {Document} document
 * @param {Sale} sale
 * @returns {Element}
 */
const as_sale = (document, { amount, session_id, date: paid_at }) => {
  const sale = document.createElementNS('http://www.w3.org/2000/svg', 'metadata')
  sale.setAttribute('itemprop', 'sale')
  sale.setAttribute('itemscope', '')

  const price = document.createElement('data')
  price.setAttribute('itemprop', 'price')
  price.setAttribute('value', String(amount))
  price.textContent = amount ? `$${(amount / 100).toFixed(2)}` : ''
  sale.appendChild(price)

  const date = document.createElement('time')
  date.setAttribute('itemprop', 'date')
  date.setAttribute('datetime', paid_at)
  sale.appendChild(date)

  const session = document.createElement('data')
  session.setAttribute('itemprop', 'session')
  session.setAttribute('value', session_id)
  session.textContent = session_id
  sale.appendChild(session)

  return sale
}

/** @typedef {{ amount: number, session_id: string, date: string }} Sale */

const SOLD = { sold: 'true' }

/**
 * Append the sale to the poster's own file, stored the way the app uploads
 * it: gzip, with a base64 SHA-256 of the html as `hash` so sync
 * notices the change, and `sold` so storage rules protect it.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @param {Sale} sale
 * @returns {Promise<boolean>} false for a repeat session or sold edition
 */
export const record_sale = async (poster_id, sale) => {
  const file = await poster_file(poster_id)
  if (!file) throw new Error(`No poster file for ${poster_id}`)
  const [
    { cacheControl, contentType, contentDisposition, contentLanguage, metadata }
  ] = await file.getMetadata()
  const [stored] = await file.download()
  const html =
    stored[0] === OPEN_ANGLE ? stored.toString('utf8') : unzip_sync(stored).toString('utf8')

  const window = new Window({ url: 'https://realness.online' })
  const container = window.document.createElement('div')
  container.innerHTML = html
  const poster = container.firstElementChild
  if (poster?.getAttribute('itemid') !== poster_id)
    throw new Error(`Poster file does not hold ${poster_id}`)

  const sales = [...poster.querySelectorAll('[itemprop="sale"]')]
  const already_recorded = sales.some(record =>
    record.querySelector('[itemprop="session"]')?.getAttribute('value') === sale.session_id
  )
  const edition_sold = sale.amount !== 50000 && sales.some(record =>
    Number(record.querySelector('[itemprop="price"]')?.getAttribute('value')) === sale.amount
  )
  if (already_recorded || edition_sold) {
    if (!metadata?.sold) await file.setMetadata({ metadata: SOLD })
    return false
  }

  poster.appendChild(as_sale(window.document, sale))
  const updated = container.innerHTML

  await file.save(gzip_sync(updated), {
    resumable: false,
    metadata: {
      cacheControl,
      contentType,
      contentEncoding: 'gzip',
      contentDisposition,
      contentLanguage,
      metadata: {
        ...metadata,
        hash: create_hash('sha256').update(updated).digest('base64'),
        ...SOLD
      }
    }
  })
  return true
}
