import { readFileSync as read_file_sync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const here = dirname(file_url_to_path(import.meta.url))

/** A path under `src/app/terminal`. */
export const terminal_file = name =>
  join(here, '../../../src/app/terminal', name)

/** A recorded terminal stream under `capture`. */
export const capture_file = name => join(here, 'capture', name)

/** The committed Ghostty engine, read as bytes because Node cannot fetch file URLs. */
export const wasm_bytes = read_file_sync(terminal_file('ghostty-vt.wasm'))
