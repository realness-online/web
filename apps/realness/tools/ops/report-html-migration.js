import { createRequire as create_require } from 'node:module'
import { pathToFileURL as path_to_file_url } from 'node:url'
import { migration_report } from '../../functions/src/services/migration-report.js'

const USAGE = 'Usage: npm run migration:report -- --project ID --bucket NAME [--apply]'

/**
 * Explicit targets only. Report by default; `--apply` copies through the
 * mirror's journal and revision guards, and must name the project's own
 * bucket, so a typo cannot point production credentials at another bucket.
 */
export const report_options = args => {
  const options = {}
  let apply = false
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (key === '--apply') {
      if (apply) throw new Error('Repeated option: --apply')
      apply = true
      continue
    }
    const value = args[index + 1]
    if (!['--project', '--bucket'].includes(key) || !value || value.startsWith('--'))
      throw new Error(USAGE)
    if (options[key]) throw new Error(`Repeated option: ${key}`)
    options[key] = value
    index++
  }
  if (!options['--project'] || !options['--bucket'])
    throw new Error(`Both --project and --bucket are required. ${USAGE}`)
  if (apply && options['--bucket'] !== `${options['--project']}.appspot.com`)
    throw new Error('--apply only writes the project\'s own appspot bucket')
  return { project: options['--project'], bucket_name: options['--bucket'], apply }
}

export const main = async args => {
  const { project, bucket_name, apply } = report_options(args)
  const require = create_require(new URL('../../functions/package.json', import.meta.url))
  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app')
  const { getStorage } = require('firebase-admin/storage')
  const { getFirestore } = require('firebase-admin/firestore')
  const app = initializeApp({
    credential: applicationDefault(), projectId: project, storageBucket: bucket_name
  }, 'html-migration-report')
  try {
    const bucket = getStorage(app).bucket()
    const [files] = await bucket.getFiles({ prefix: 'people/' })
    const rows = migration_report(files.map(file => file.metadata))
    const counts = {}
    for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1
    const report = { project, bucket: bucket_name, read_only: !apply, counts }
    if (!apply) {
      console.info(JSON.stringify({ ...report, rows }, null, 2))
      return
    }
    const { rules_protect_both, released_storage_rules } =
      await import('../../functions/src/services/rules-preflight.js')
    const fetch_json = async url => {
      const { access_token } = await app.options.credential.getAccessToken()
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${access_token}`, 'x-goog-user-project': project }
      })
      if (!response.ok) throw new Error(`Rules lookup failed: ${response.status}`)
      return response.json()
    }
    const rules = await released_storage_rules({ project, bucket_name, fetch_json })
    if (!rules_protect_both(rules))
      throw new Error('Live storage rules do not protect relations.html; deploy realness rules first')
    const { migration_apply } = await import('../../functions/src/services/migration-apply.js')
    const { mirror_journal } = await import('../../functions/src/services/mirror-journal.js')
    const { mirror_reconcile } = await import('../../functions/src/services/mirror-reconcile.js')
    const journal = mirror_journal({ db: getFirestore(app) })
    const applied = await migration_apply({
      rows, reconcile: name => mirror_reconcile({ bucket, journal, name })
    })
    console.info(JSON.stringify({ ...report, applied }, null, 2))
    if (applied.failures.length) process.exitCode = 1
  } finally {
    await deleteApp(app)
  }
}

if (process.argv[1] && import.meta.url === path_to_file_url(process.argv[1]).href)
  await main(process.argv.slice(2))
