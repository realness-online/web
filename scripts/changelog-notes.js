import fs from 'node:fs'
import path from 'node:path'
import {
  changelog_root,
  extract_changelog_section,
  package_version,
  read_changelog,
  release_notes_footer
} from './lib/changelog.js'

const artifacts_dir = path.join(changelog_root, 'artifacts')
const default_out = path.join(artifacts_dir, 'release-notes.md')

const main = () => {
  const args = process.argv.slice(2)
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
      process.exit(0)
    }

  const changelog = read_changelog()
  const section = extract_changelog_section(changelog, version, {
    include_heading: true
  })
  const notes = `${section.trim()}\n${release_notes_footer(version)}`

  fs.mkdirSync(path.dirname(out_path), { recursive: true })
  fs.writeFileSync(out_path, notes)
  console.info(`Wrote ${out_path} (${notes.trim().split('\n').length} lines)`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
