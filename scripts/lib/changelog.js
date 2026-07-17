import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script_path = fileURLToPath(import.meta.url)
export const changelog_root = path.join(path.dirname(script_path), '../..')
export const changelog_path = path.join(changelog_root, 'CHANGELOG.md')

/** @param {string} version */
export const bare_version = version => version.replace(/^v/, '')

/**
 * Find a `## …` section. Returns start/end line indexes into `lines`
 * (end exclusive). start is -1 when missing.
 * @param {string[]} lines
 * @param {RegExp} heading_re
 */
const find_section = (lines, heading_re) => {
  let start = -1
  for (let i = 0; i < lines.length; i++)
    if (heading_re.test(lines[i])) {
      start = i
      break
    }
  if (start < 0) return { start: -1, end: -1 }

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++)
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  return { start, end }
}

/**
 * Drop the `## Unreleased` section so public docs only show shipped history.
 * @param {string} changelog
 */
export const strip_unreleased = changelog => {
  const lines = changelog.split(/\r?\n/)
  const { start, end } = find_section(lines, /^##\s+Unreleased\b/i)
  if (start < 0) return changelog
  const next = [...lines.slice(0, start), ...lines.slice(end)]
  return next.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * @param {string} changelog
 * @returns {{ heading: string, body: string }}
 */
export const read_unreleased = changelog => {
  const lines = changelog.split(/\r?\n/)
  const { start, end } = find_section(lines, /^##\s+Unreleased\b/i)
  if (start < 0)
    throw new Error(
      'CHANGELOG.md has no ## Unreleased section. Add one under the title.'
    )
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
  return { heading: lines[start], body }
}

/**
 * Promote ## Unreleased into a dated version heading; leave a fresh empty
 * ## Unreleased on top for the next cycle.
 * @param {string} changelog
 * @param {string} version bare or v-prefixed
 * @param {Date} [date]
 */
export const promote_unreleased = (changelog, version, date = new Date()) => {
  const bare = bare_version(version)
  const { body } = read_unreleased(changelog)
  if (!body.trim())
    throw new Error(
      '## Unreleased is empty. Add release notes before npm version.'
    )

  const iso = date.toISOString().slice(0, 10)
  const released_heading = `## v${bare} — ${iso}`
  const without = strip_unreleased(changelog)
  const title_match = without.match(/^#\s+.+\n+/)
  const title = title_match ? title_match[0] : '# Changelog\n\n'
  const rest = without.slice(title.length).replace(/^\n+/, '')

  return (
    `${title}` +
    `## Unreleased\n\n` +
    `${released_heading}\n\n` +
    `${body.trim()}\n\n` +
    `${rest}`
  ).replace(/\n{3,}/g, '\n\n')
}

/**
 * Pull one version section from CHANGELOG.md.
 * Matches headings like `## v2.5.12 — 2026-07-16`.
 *
 * @param {string} changelog
 * @param {string} version
 * @param {{ include_heading?: boolean }} [opts]
 */
export const extract_changelog_section = (changelog, version, opts = {}) => {
  const bare = bare_version(version)
  const needle = new RegExp(`^## v${bare.replace(/\./g, '\\.')}\\b`)
  const lines = changelog.split(/\r?\n/)
  const { start, end } = find_section(lines, needle)

  if (start < 0)
    throw new Error(
      `No CHANGELOG.md section for v${bare}. Run npm version after writing ## Unreleased.`
    )

  const section_body = lines
    .slice(start + 1, end)
    .join('\n')
    .trim()
  if (!section_body)
    throw new Error(`CHANGELOG.md section for v${bare} is empty`)

  const from = opts.include_heading ? start : start + 1
  const text = lines
    .slice(from, end)
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')

  return `${text}\n`
}

/**
 * @param {string} version
 */
export const release_notes_footer = version => {
  const bare = bare_version(version)
  return (
    `\n---\n\n` +
    `Verify this build: \`npm run verify -- --release v${bare}\`\n\n` +
    `Full history: \`CHANGELOG.md\` in the repo (also on /docs#changelog).\n`
  )
}

export const package_version = () => {
  const package_path = path.join(changelog_root, 'package.json')
  return JSON.parse(fs.readFileSync(package_path, 'utf8')).version
}

export const read_changelog = () => fs.readFileSync(changelog_path, 'utf8')

export const write_changelog = text => {
  fs.writeFileSync(changelog_path, text.endsWith('\n') ? text : `${text}\n`)
}
