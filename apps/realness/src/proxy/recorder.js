import { appendFile as append_file, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ISO_DATE } from '#root/lib/units.js'

/**
 * l11: every model call a person makes, written whole to this Mac's disk:
 * one JSON line per call in `<dir>/<phone>/<day>.jsonl`. Never synced,
 * never sent anywhere; the proxy only turns it on when started with
 * `--record <dir>`.
 * @param {string} dir
 */
export const disk_recorder = dir => async (phone, entry) => {
  const folder = join(dir, phone)
  await mkdir(folder, { recursive: true })
  const day = entry.at.slice(0, ISO_DATE)
  await append_file(join(folder, `${day}.jsonl`), `${JSON.stringify(entry)}\n`)
}
