import { createHash as create_hash } from 'node:crypto'
import { gzipSync as gzip_sync, unzipSync as unzip_sync } from 'node:zlib'
import { Window } from 'happy-dom'
import { bucket } from '#utils/firebase.js'

const OPEN_ANGLE = 60
const VERSION_LENGTH = 22

/** Sync's version: SHA-256 of the plain bytes, base64url, 22 characters. */
const sync_version = html =>
  create_hash('sha256')
    .update(html)
    .digest('base64url')
    .slice(0, VERSION_LENGTH)

const plain_name = name => (name.endsWith('.gz') ? name.slice(0, -3) : name)

/**
 * Where a poster's html lives: `people/<author>/posters/<created>.html.gz`
 * for sync, or an archive folder one level deeper once the app has paged the
 * oldest posters away. The plain `.html` is the fallback until gz6 removes it.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @returns {Promise<ReturnType<typeof bucket.file> | null>}
 */
export const poster_file = async poster_id => {
  const [, author, type, created] = poster_id.split('/')
  if (!author || type !== 'posters' || !created) return null
  const prefix = `people/${author}/posters/`
  const live = bucket.file(`${prefix}${created}.html.gz`)
  if ((await live.exists())[0]) return live
  const plain = bucket.file(`${prefix}${created}.html`)
  if ((await plain.exists())[0]) return plain

  const [files] = await bucket.getFiles({ prefix })
  const archived = files.find(file => file.name.endsWith(`/${created}.html.gz`))
  if (archived) return bucket.file(archived.name)
  const old = files.find(file => file.name.endsWith(`/${created}.html`))
  return old ? bucket.file(old.name) : null
}

/**
 * The sale record the app reads back as `item.sale`: price, date, and the
 * Stripe session that paid for it.
 * @param {Document} document
 * @param {Sale} sale
 * @returns {Element}
 */
const as_sale = (document, { amount, session_id, date: paid_at }) => {
  const sale = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'metadata'
  )
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

/** Keep both copies' `sold` meta while the plain copy is still there. */
const mark_sold = async file => {
  const plain = bucket.file(plain_name(file.name))
  await file.setMetadata({ metadata: SOLD })
  if (file.name.endsWith('.gz') && (await plain.exists())[0])
    await plain.setMetadata({ metadata: SOLD })
}

/**
 * Save the poster the way sync stores it: `.html.gz`, gzip bytes, the plain
 * bytes' version and size in metadata. While the plain copy exists, update it
 * too, so Firebase readers and a rollback keep working until gz6.
 */
const save_poster = async (file, html, metadata) => {
  const packed = gzip_sync(html)
  const name = file.name.endsWith('.gz') ? file.name : `${file.name}.gz`
  const common = {
    resumable: false,
    metadata: {
      cacheControl: metadata.cacheControl,
      contentType: metadata.contentType,
      contentEncoding: 'gzip',
      contentDisposition: metadata.contentDisposition,
      contentLanguage: metadata.contentLanguage,
      metadata: {
        ...metadata.metadata,
        hash: create_hash('sha256').update(html).digest('base64'),
        ...SOLD
      }
    }
  }
  await bucket.file(name).save(packed, {
    ...common,
    metadata: {
      ...common.metadata,
      metadata: {
        ...common.metadata.metadata,
        version: sync_version(html),
        size: String(Buffer.byteLength(html))
      }
    }
  })
  const plain = bucket.file(plain_name(name))
  if (!file.name.endsWith('.gz') || (await plain.exists())[0])
    await plain.save(packed, common)
}

/**
 * Append the sale to the poster's own file, in sync's layout and, while it
 * remains, the plain Firebase copy. `sold` protects it from owner overwrites.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @param {Sale} sale
 * @returns {Promise<boolean>} false for a repeat session or sold edition
 */
export const record_sale = async (poster_id, sale) => {
  const file = await poster_file(poster_id)
  if (!file) throw new Error(`No poster file for ${poster_id}`)
  const [metadata] = await file.getMetadata()
  const [stored] = await file.download()
  const html =
    stored[0] === OPEN_ANGLE
      ? stored.toString('utf8')
      : unzip_sync(stored).toString('utf8')

  const window = new Window({ url: 'https://realness.online' })
  const container = window.document.createElement('div')
  container.innerHTML = html
  const poster = container.firstElementChild
  if (poster?.getAttribute('itemid') !== poster_id)
    throw new Error(`Poster file does not hold ${poster_id}`)

  const sales = [...poster.querySelectorAll('[itemprop="sale"]')]
  const already_recorded = sales.some(
    record =>
      record.querySelector('[itemprop="session"]')?.getAttribute('value') ===
      sale.session_id
  )
  const edition_sold =
    sale.amount !== 50000 &&
    sales.some(
      record =>
        Number(
          record.querySelector('[itemprop="price"]')?.getAttribute('value')
        ) === sale.amount
    )
  if (already_recorded || edition_sold) {
    if (!metadata.metadata?.sold) await mark_sold(file)
    return false
  }

  poster.appendChild(as_sale(window.document, sale))
  await save_poster(file, container.innerHTML, metadata)
  return true
}
