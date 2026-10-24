import {
  package_version,
  promote_unreleased,
  read_changelog,
  write_changelog,
  changelog_path
} from './lib/changelog.js'
import { run_entry } from './lib/entry.js'

/**
 * Turn the Unreleased changelog section into the package version's section.
 * @param {object} [options]
 * @param {() => string} [options.version]
 * @param {() => string} [options.read]
 * @param {(text: string) => void} [options.write]
 */
export const main = ({
  version = package_version,
  read = read_changelog,
  write = write_changelog
} = {}) => {
  const current = version()
  write(promote_unreleased(read(), current))
  console.info(
    `Promoted ## Unreleased → v${current.replace(/^v/, '')} in ${changelog_path}`
  )
}

await run_entry(import.meta.url, main)
