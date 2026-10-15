import { unzipSync as unzip_sync } from 'node:zlib'
import { Window } from 'happy-dom'
import { bucket } from '#utils/firebase.js'
import { thought_for_poster, thought_text } from '@realness.online/thoughts'
import { unique_html_files } from '#services/html-files.js'
import { poster_file } from '#services/sale.js'

const origin = 'https://realness.online'
const PREVIEW_TOKEN = 'firebaseStorageDownloadTokens'

/** The app's parser reads compressed posters the same way. */
const as_html = stored =>
  stored[0] === 60 ? stored.toString('utf8') : unzip_sync(stored).toString('utf8')

/**
 * The statements in one statements file, shaped the way the thought rulebook
 * reads them: an id that carries the timestamp, and the words.
 * @param {string} html
 * @returns {Array<{ id: string, statement: string }>}
 */
const as_statements = html => {
  const window = new Window({ url: origin })
  const container = window.document.createElement('div')
  container.innerHTML = html
  return [...container.querySelectorAll('[itemprop="statement"]')]
    .map(element => ({
      id: element.closest('[itemid]')?.getAttribute('itemid') ?? '',
      statement: (element.textContent ?? '').trim()
    }))
    .filter(entry => entry.id && entry.statement)
}

/**
 * The author's whole statement history: the live file and every page paged
 * away behind it, so a thought is never cut in half by where paging landed.
 * @param {string} author - e.g. `/+16282281824`
 * @returns {Promise<Array<{ id: string, statement: string }>>}
 */
const author_statements = async author => {
  const prefix = `people/${author.replace(/^\//, '')}/statements/`
  const [objects] = await bucket.getFiles({ prefix })
  const statements = []
  for (const object of unique_html_files(objects)) {
    // eslint-disable-next-line no-await-in-loop -- a page at a time
    const [stored] = await bucket.file(object.name).download()
    statements.push(...as_statements(as_html(stored)))
  }
  return statements
}

/**
 * The public URL of a print's PNG preview, or null when it has none. The
 * previews script puts a PNG and a Firebase download token beside each
 * poster; that URL serves without auth, which is what Stripe needs.
 * A storage hiccup must not stop a sale, so it answers null too.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @returns {Promise<string | null>}
 */
export const print_preview_url = async poster_id => {
  const [, author, type, created] = poster_id.split('/')
  if (!author || type !== 'posters' || !created) return null
  try {
    const path = `people/${author}/posters/${created}.png`
    const file = bucket.file(path)
    if (!(await file.exists())[0]) return null
    const [metadata] = await file.getMetadata()
    const token = metadata?.metadata?.[PREVIEW_TOKEN]
    if (!token) return null
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
  } catch {
    return null
  }
}

/** Only dates are public; do not expose the stored payment session or buyer. */
export const sale_dates = (html, poster_id) => {
  const window = new Window({ url: origin })
  const container = window.document.createElement('div')
  container.innerHTML = html
  const poster = container.firstElementChild
  if (poster?.getAttribute('itemid') !== poster_id)
    throw new Error('Poster ID mismatch')
  return [...poster.querySelectorAll('[itemprop="sale"] [itemprop="date"]')]
    .map(date => date.getAttribute('datetime'))
    .filter(date => date && !Number.isNaN(Date.parse(date)))
}

/**
 * Everything a print's own page shows about it: its preview image, the thought
 * it was made with, and the dates it sold on.
 * @param {string} poster_id - e.g. `/+16282281824/posters/1712000000000`
 * @returns {Promise<{ image: string | null, thought: string, dates: string[] }>}
 */
export const print_details = async poster_id => {
  const [, author] = poster_id.split('/')
  const [image, dates] = await Promise.all([
    print_preview_url(poster_id),
    print_sale_dates(poster_id)
  ])
  return {
    image,
    thought: thought_from(await print_statements(author), poster_id),
    dates
  }
}

/**
 * The thought one print was made with, read from statements already in hand.
 * A list of prints reads the author's statements once and reuses them: reading
 * them per print is what runs a function out of memory.
 * @param {Array<{ id: string, statement: string }>} statements
 * @param {string} poster_id
 * @returns {string}
 */
const thought_from = (statements, poster_id) =>
  thought_text(thought_for_poster([{ id: poster_id }, ...statements], poster_id))

/**
 * One row per print for a list, in the order the stamps are given. The author's
 * statements are read once for the whole list: reading them per print is what
 * runs a function out of memory. Prints go one at a time for the same reason.
 * @param {string} author - e.g. `/+16282281824`
 * @param {string[]} stamps - created stamps, newest first
 * @returns {Promise<Array<{ id: string, image: string | null, thought: string, dates: string[] }>>}
 */
export const print_rows = async (author, stamps) => {
  const statements = await print_statements(author.replace(/^\//, ''))
  const rows = []
  for (const stamp of stamps) {
    const poster_id = `${author}/posters/${stamp}`
    // eslint-disable-next-line no-await-in-loop -- a print at a time keeps the instance inside its memory
    const [image, dates] = await Promise.all([
      print_preview_url(poster_id),
      print_sale_dates(poster_id)
    ])
    rows.push({
      id: stamp,
      image,
      thought: thought_from(statements, poster_id),
      dates
    })
  }
  return rows
}

/**
 * The author's statements, or none when they cannot be read.
 * @param {string} author - e.g. `+16282281824`
 * @returns {Promise<Array<{ id: string, statement: string }>>}
 */
const print_statements = async author => {
  if (!author) return []
  try {
    return await author_statements(`/${author}`)
  } catch {
    return []
  }
}

/**
 * The sale dates a poster's own file records, or none when it cannot be read.
 * @param {string} poster_id
 * @returns {Promise<string[]>}
 */
const print_sale_dates = async poster_id => {
  try {
    const file = await poster_file(poster_id)
    if (!file) return []
    const [stored] = await file.download()
    return sale_dates(as_html(stored), poster_id)
  } catch {
    return []
  }
}
