import {
  package_version,
  promote_unreleased,
  read_changelog,
  write_changelog,
  changelog_path
} from './lib/changelog.js'

const main = () => {
  const version = package_version()
  const next = promote_unreleased(read_changelog(), version)
  write_changelog(next)
  console.info(
    `Promoted ## Unreleased → v${version.replace(/^v/, '')} in ${changelog_path}`
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
