import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ISO_DATE } from '#root/lib/units.js'
import { append_item } from '#root/src/files/item-log.js'

/**
 * l11: every model call a person makes, written whole to this Mac's disk:
 * one item per call in `<dir>/<phone>/<day>.html.gz`, gzip members of HTML
 * like a Pi session. Never synced, never sent anywhere; the proxy only turns
 * it on when started with `--record <dir>`.
 * @param {string} dir
 */
export const disk_recorder = dir => async (phone, entry) => {
  const folder = join(dir, phone)
  await mkdir(folder, { recursive: true })
  const day = entry.at.slice(0, ISO_DATE)
  await append_item(join(folder, `${day}.html.gz`), 'model-call', {
    at: entry.at,
    actor: entry.actor ?? '',
    model: entry.model ?? '',
    status: entry.status ?? '',
    client: entry.client ?? '',
    request: body_text(entry.request),
    response: entry.response ?? ''
  })
}

/** A request body as the text it was sent as, whatever shape it came in. */
const body_text = body =>
  typeof body === 'string' ? body : JSON.stringify(body ?? '')
