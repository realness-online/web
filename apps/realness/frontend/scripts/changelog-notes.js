import fs from 'node:fs'
import path from 'node:path'
import {
  extract_changelog_section,
  package_version,
  read_changelog,
  release_notes_footer
} from './lib/changelog.js'

import { fileURLToPath as file_url_to_path } from 'node:url'
import { out_path as output_path } from '#root/src/settings/output.js'
const default_out = output_path('frontend', 'release-notes.md')

export const main = (args = process.argv.slice(2)) => {
  let version = package_version()
  let out_path = default_out

  for (let i = 0; i < args.length; i++)
    if (args[i] === '--version' && args[i + 1]) version = args[++i]
    else if (args[i] === '--out' && args[i + 1]) out_path = args[++i]
    else if (args[i] === '--help' || args[i] === '-h') {
      console.info(
        'Usage: node scripts/changelog-notes.js [--version X.Y.Z] [--out path]\n' +
          'Writes GitHub release notes from CHANGELOG.md (heading + body + verify footer).'
      )
      return { help: true }
    }

  const changelog = read_changelog()
  const section = extract_changelog_section(changelog, version, {
    include_heading: true
  })
  const notes = `${section.trim()}\n${release_notes_footer(version)}`

  fs.mkdirSync(path.dirname(out_path), { recursive: true })
  fs.writeFileSync(out_path, notes)
  console.info(`Wrote ${out_path} (${notes.trim().split('\n').length} lines)`)
  return { out_path, notes }
}

if (process.argv[1] === file_url_to_path(import.meta.url))
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
