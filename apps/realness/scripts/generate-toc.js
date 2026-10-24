/**
 * Pre-compute table-of-contents data from markdown content files
 * so views can import them statically instead of parsing at runtime.
 *
 * Run BEFORE the Vite build (added to the build chain in package.json).
 */

import {
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync,
  mkdirSync as mkdir_sync
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { product_paths } from '#root/src/settings/layout.js'

/** @param {string} title */
export const heading_id = title =>
  String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * @param {string} content
 * @returns {Array<{ id: string, title: string, level: number }>}
 */
export const markdown_toc = content => {
  const toc = []
  for (const line of content.split('\n')) {
    const match = line.match(/^(#{2,6})\s+(.+)$/)
    if (!match) continue
    toc.push({
      id: heading_id(match[2].trim()),
      title: match[2].trim(),
      level: match[1].length
    })
  }
  return toc
}

/**
 * Write the table-of-contents module.
 * @param {{ content_dir?: string, out_path?: string }} [paths]
 */
export const generate = ({
  content_dir = join(product_paths().app, 'content'),
  out_path = join(product_paths().app, 'prerender', 'toc.js')
} = {}) => {
  const documentation_md = read_file_sync(
    join(content_dir, 'documentation.md'),
    'utf8'
  )
  const terms_md = read_file_sync(join(content_dir, 'terms.md'), 'utf8')
  const privacy_md = read_file_sync(join(content_dir, 'privacy.md'), 'utf8')
  const license_md = read_file_sync(join(content_dir, 'license.md'), 'utf8')

  const documentation_preferences_toc = [
    { id: 'preferences', title: 'Preferences', level: 2 },
    { id: 'preferences-mosaic', title: 'Mosaic', level: 3 },
    { id: 'preferences-shadow', title: 'Shadow', level: 3 },
    { id: 'preferences-motion', title: 'Motion', level: 3 },
    { id: 'preferences-view', title: 'View', level: 3 },
    { id: 'preferences-chrome', title: 'Chrome', level: 3 }
  ]

  const documentation_changelog_toc = [
    { id: 'changelog', title: 'Changelog', level: 2 }
  ]

  const documentation_toc = [
    ...markdown_toc(documentation_md),
    ...documentation_preferences_toc,
    ...documentation_changelog_toc
  ]
  const terms_toc = markdown_toc(terms_md)
  const privacy_toc = markdown_toc(privacy_md)
  const license_toc = markdown_toc(license_md)

  const out_dir = out_path.match(/.+\//)?.[0]
  if (out_dir) mkdir_sync(out_dir, { recursive: true })

  const code = [
    '',
    '/* eslint-disable */',
    '',
    'export const documentation_toc = ',
    JSON.stringify(documentation_toc, null, 2),
    '',
    'export const terms_toc = ',
    JSON.stringify(terms_toc, null, 2),
    '',
    'export const privacy_toc = ',
    JSON.stringify(privacy_toc, null, 2),
    '',
    'export const license_toc = ',
    JSON.stringify(license_toc, null, 2),
    ''
  ].join('\n')

  write_file_sync(out_path, code)
  console.info(
    `generate-toc: wrote ${out_path} (${documentation_toc.length + terms_toc.length + privacy_toc.length + license_toc.length} entries)`
  )
  return out_path
}

if (process.argv[1] === file_url_to_path(import.meta.url)) generate()
