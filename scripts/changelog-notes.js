import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script_path = fileURLToPath(import.meta.url)
const root = path.join(path.dirname(script_path), '..')
const changelog_path = path.join(root, 'CHANGELOG.md')

/**
 * Pull the body for one version heading from CHANGELOG.md.
 * Matches headings like `## 2026-07-13 → 07-15 — v2.5.11` or `## 2026-07-11 — v2.5.9`.
 *
 * @param {string} changelog
 * @param {string} version bare or v-prefixed (e.g. `2.5.11` / `v2.5.11`)
 * @returns {string}
 */
export const extract_changelog_section = (changelog, version) => {
  const bare = version.replace(/^v/, '')
  const needle = new RegExp(`^## .+\\bv${bare.replace(/\./g, '\\.')}\\b`)
  const lines = changelog.split(/\r?\n/)
  let start = -1

  for (let i = 0; i < lines.length; i++)
    if (needle.test(lines[i])) {
      start = i
      break
    }

  if (start < 0)
    throw new Error(
      `No CHANGELOG.md section for v${bare}. Add a ## heading that includes v${bare}.`
    )

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++)
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }

  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')

  if (!body.trim())
    throw new Error(`CHANGELOG.md section for v${bare} is empty`)

  return `${body}\n`
}

const package_version = () => {
  const package_path = path.join(root, 'package.json')
  return JSON.parse(fs.readFileSync(package_path, 'utf8')).version
}

const main = () => {
  const args = process.argv.slice(2)
  let version = package_version()
  let out_path = null

  for (let i = 0; i < args.length; i++)
    if (args[i] === '--version' && args[i + 1]) version = args[++i]
    else if (args[i] === '--out' && args[i + 1]) out_path = args[++i]
    else if (args[i] === '--help' || args[i] === '-h') {
      console.info(
        'Usage: node scripts/changelog-notes.js [--version X.Y.Z] [--out path]\n' +
          'Prints (or writes) the CHANGELOG.md body for that version.'
      )
      process.exit(0)
    }

  const changelog = fs.readFileSync(changelog_path, 'utf8')
  const notes = extract_changelog_section(changelog, version)

  if (out_path) {
    fs.writeFileSync(out_path, notes)
    console.info(`Wrote ${out_path} (${notes.trim().split('\n').length} lines)`)
    return
  }

  process.stdout.write(notes)
}

const is_main =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(script_path)

if (is_main)
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
