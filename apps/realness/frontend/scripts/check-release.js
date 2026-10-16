import fs from 'node:fs'
import { frontend_out } from '#root/src/settings/output.js'
import {
  bare_version,
  extract_changelog_section,
  package_version,
  read_changelog,
  read_unreleased
} from './lib/changelog.js'
import { run_entry } from './lib/entry.js'

/**
 * Check the changelog and built manifest agree before a release.
 * @param {string[]} [args]
 */
export const main = (args = process.argv.slice(2)) => {
  const unreleased_only = args.includes('--unreleased')
  const changelog = read_changelog()

  if (unreleased_only) {
    const { body } = read_unreleased(changelog)
    if (!body.trim())
      throw new Error(
        '## Unreleased is empty. Add notes under ## Unreleased, then run npm version.'
      )
    console.info('## Unreleased has notes — ok to version')
    return
  }

  const version = package_version()
  const bare = bare_version(version)
  extract_changelog_section(changelog, bare)

  const manifest_path = frontend_out('build-manifest.json')
  if (!fs.existsSync(manifest_path))
    throw new Error(
      `Missing ${manifest_path}. Run npm run deploy (or build) before release:gh.`
    )

  const manifesto = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
  if (bare_version(String(manifesto.version ?? '')) !== bare)
    throw new Error(
      `dist/build-manifest.json version is ${manifesto.version}, package.json is ${bare}. Rebuild after bumping.`
    )

  console.info(`check-release ok (v${bare}, manifesto matches)`)
}

await run_entry(import.meta.url, main)
