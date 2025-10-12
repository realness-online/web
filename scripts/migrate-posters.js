import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import 'dotenv/config'

const SERVICE_ACCOUNT_PATH = join('scripts', 'service-account.json')

const init_firebase = async () => {
  try {
    console.info(chalk.dim('Initializing Firebase...'))
    const service_account = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, 'utf-8')
    )

    console.info(
      chalk.dim('Storage bucket: ') +
        chalk.cyan(process.env.VITE_STORAGE_BUCKET)
    )

    initializeApp({
      credential: cert(service_account),
      storageBucket: process.env.VITE_STORAGE_BUCKET
    })

    const bucket = getStorage().bucket()
    console.info(chalk.green('✓ Firebase initialized'))
    return bucket
  } catch (error) {
    console.error(chalk.red('Firebase initialization failed:'), error)
    throw error
  }
}

const is_old_poster = file_name => {
  // Match pattern: people/+phone/posters/{created_at}.html.gz
  // (not in a subfolder, not index.html.gz)
  const parts = file_name.split('/')

  // Should be: people/+phone/posters/{timestamp}.html.gz
  const EXPECTED_PARTS = 4
  if (parts.length !== EXPECTED_PARTS) return false

  const [prefix, _phone, type, file] = parts
  if (prefix !== 'people') return false
  if (type !== 'posters') return false
  if (file === 'index.html.gz') return false // Already migrated

  const created_at = file.replace('.html.gz', '')
  return !isNaN(created_at) && created_at.length > 0
}

const migrate_poster = async (bucket, file) => {
  try {
    const old_path = file.name
    console.info(chalk.cyan('\nMigrating: ') + chalk.dim(old_path))

    // Extract created_at from old path
    const parts = old_path.split('/')
    const file_name = parts[parts.length - 1]
    const created_at = file_name.replace('.html.gz', '')

    // Build new path: people/+phone/posters/{created_at}/index.html.gz
    const base_path = parts.slice(0, -1).join('/')
    const new_path = `${base_path}/${created_at}/index.html.gz`

    console.info(chalk.dim('To: ') + new_path)

    // Get file metadata and content
    const [metadata] = await file.getMetadata()
    const [content] = await file.download()

    // Upload to new location with same metadata
    const new_file = bucket.file(new_path)
    await new_file.save(content, {
      metadata: metadata.metadata,
      contentType: metadata.contentType,
      contentEncoding: metadata.contentEncoding
    })

    console.info(chalk.green('✓ Uploaded to new location'))

    // Verify new file exists before deleting old one
    const [exists] = await new_file.exists()
    if (!exists) {
      console.error(chalk.red('✗ New file verification failed'))
      return { success: false, old_path, new_path }
    }

    // Delete old file
    await file.delete()
    console.info(chalk.green('✓ Deleted old file'))

    return { success: true, old_path, new_path }
  } catch (error) {
    console.error(chalk.red('✗ Migration failed:'), error)
    return { success: false, old_path: file.name, error: error.message }
  }
}

const main = async () => {
  try {
    console.info(chalk.bold('Starting poster migration'))
    console.info(chalk.dim('Converting single-file to folder structure\n'))

    const bucket = await init_firebase()

    console.info(chalk.cyan('Listing poster files in Firebase Storage...'))
    const [files] = await bucket.getFiles({ prefix: 'people/' })

    const old_posters = files.filter(file => is_old_poster(file.name))

    console.info(
      chalk.dim('Found posters to migrate: ') + chalk.green(old_posters.length)
    )

    if (old_posters.length === 0) {
      console.info(chalk.yellow('No posters to migrate!'))
      return
    }

    let successful = 0
    let failed = 0
    const results = []

    /* eslint-disable no-await-in-loop */
    for (const file of old_posters) {
      const result = await migrate_poster(bucket, file)
      results.push(result)

      if (result.success) successful++
      else failed++

      const total = successful + failed
      const PERCENT = 100
      const progress = Math.round((total / old_posters.length) * PERCENT)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${old_posters.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */

    console.info(chalk.bold('\nMigration Summary:'))
    console.info(chalk.dim('Total files: ') + (successful + failed))
    console.info(chalk.dim('Successful: ') + chalk.green(successful))
    console.info(
      chalk.dim('Failed: ') +
        (failed > 0 ? chalk.red(failed) : chalk.green('0'))
    )

    if (failed > 0) {
      console.info(chalk.yellow('\nFailed migrations:'))
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.info(chalk.red(`  ${r.old_path}`))
          if (r.error) console.info(chalk.dim(`    Error: ${r.error}`))
        })
    }

    console.info(chalk.green.bold('\nMigration completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
