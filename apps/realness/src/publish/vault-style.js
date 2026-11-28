/**
 * The stylesheet vault pages link at `realness.online/style.css`: the
 * renderer's sheets as one file, in cascade order, so a vault page links one
 * URL and gets the palette, the fonts, and the page rules.
 */
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

/** The sheets a vault page needs, in cascade order. */
export const VAULT_SHEETS = [
  'palette.css',
  'color.css',
  'font.css',
  'style.css'
]

/**
 * @param {string} folder the renderer's static folder
 * @returns {string}
 */
export const vault_style = folder =>
  VAULT_SHEETS.map(name => read_file_sync(join(folder, name), 'utf8')).join(
    '\n'
  )
