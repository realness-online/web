import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { inflate } from 'node:zlib'
import { promisify } from 'node:util'
import chalk from 'chalk'
import { initializeApp, cert, getApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import 'dotenv/config'

const inflate_async = promisify(inflate)
const DATA_DIR = 'storage'
const PEOPLE_DIR = join(DATA_DIR, 'people')

const cached_buckets = {}

const init_firebase = async (environment = 'development') => {
  if (cached_buckets[environment]) return cached_buckets[environment]

  try {
    console.info(chalk.dim(`Initializing Firebase (${environment})...`))
    const service_account_path = join(
      'scripts',
      `service-account-${environment}.json`
    )
    const service_account = JSON.parse(
      await readFile(service_account_path, 'utf-8')
    )

    if (cached_buckets[environment]) return cached_buckets[environment]

    const storage_bucket = `${service_account.project_id}.appspot.com`

    console.info(chalk.dim('Storage bucket: ') + chalk.cyan(storage_bucket))

    initializeApp(
      {
        credential: cert(service_account),
        storageBucket: storage_bucket
      },
      environment
    )

    const app = getApp(environment)
    cached_buckets[environment] = getStorage(app).bucket()
    console.info(chalk.green('✓ Firebase initialized'))
    return cached_buckets[environment]
  } catch (error) {
    console.error(chalk.red('Firebase initialization failed:'), error)
    throw error
  }
}

const ensure_dir = async dir_path => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

export const upload_to_firebase = async (
  files,
  environment = 'development'
) => {
  console.time('Upload to Firebase')
  try {
    const bucket = await init_firebase(environment)

    console.info(chalk.bold('\nStarting uploads:'))
    console.info(chalk.dim('Files to process: ') + chalk.green(files.length))

    const BATCH_SIZE = 13
    let successful = 0
    let failed = 0

    const upload_file = async ({
      compressed_path,
      metadata_path,
      upload_path
    }) => {
      const metadata = JSON.parse(await readFile(metadata_path, 'utf-8'))
      const compressed_data = await readFile(compressed_path)

      const file = bucket.file(upload_path)
      await file.save(compressed_data, {
        metadata: {
          contentType: metadata.contentType,
          contentEncoding: metadata.contentEncoding,
          cacheControl: metadata.cacheControl,
          contentLanguage: metadata.contentLanguage,
          contentDisposition: metadata.contentDisposition,
          metadata: metadata.customMetadata
        }
      })
    }

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(file => upload_file(file))
      )

      results.forEach(result => {
        if (result.status === 'fulfilled') successful++
        else {
          failed++
          console.error(chalk.red('✗ Upload failed:'), result.reason)
        }
      })

      const total = successful + failed
      const PERCENT = 100
      const progress = Math.round((total / files.length) * PERCENT)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${files.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */

    console.timeEnd('Upload to Firebase')
    return { successful, failed }
  } catch (error) {
    console.timeEnd('Upload to Firebase')
    console.error(chalk.red.bold('Upload process failed:'), error)
    throw error
  }
}

export const cleanup_old_posters = async (environment = 'development') => {
  console.time('Cleanup old posters')
  try {
    const bucket = await init_firebase(environment)

    console.info(chalk.cyan('\nListing users...'))
    const [files] = await bucket.getFiles({ prefix: 'people/' })

    // Get unique phone numbers
    const phones = new Set()
    files.forEach(file => {
      const parts = file.name.split('/')
      if (parts.length >= 2) phones.add(parts[1])
    })

    console.info(chalk.dim('Found users: ') + chalk.green(phones.size))

    const BATCH_SIZE = 13
    let deleted_users = 0
    let failed = 0

    const delete_user_posters = async phone => {
      const prefix = `people/${phone}/posters/`
      console.info(chalk.dim('Deleting: ') + prefix)
      await bucket.deleteFiles({ prefix })
      console.info(chalk.green('✓ Deleted'))
    }

    const phones_array = Array.from(phones)

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < phones_array.length; i += BATCH_SIZE) {
      const batch = phones_array.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(phone => delete_user_posters(phone))
      )

      results.forEach(result => {
        if (result.status === 'fulfilled') deleted_users++
        else {
          failed++
          console.error(chalk.red('✗ Failed:'), result.reason)
        }
      })
    }
    /* eslint-enable no-await-in-loop */

    console.timeEnd('Cleanup old posters')
    return { deleted: deleted_users, failed }
  } catch (error) {
    console.timeEnd('Cleanup old posters')
    console.error(chalk.red.bold('Cleanup process failed:'), error)
    throw error
  }
}

export const download_from_firebase = async (environment = 'production') => {
  console.time('Download from Firebase')
  const bucket = await init_firebase(environment)

  console.info(chalk.cyan('\nListing files in Firebase Storage...'))
  const [files] = await bucket.getFiles({ prefix: 'people/' })

  console.info(chalk.dim('Found files: ') + chalk.green(files.length))

  const BATCH_SIZE = 13
  let successful = 0
  let failed = 0

  const process_file = async file => {
    const [content] = await file.download()

    const output_path = join(PEOPLE_DIR, file.name.replace('people/', ''))
    await ensure_dir(dirname(output_path))

    let final_content = content
    let final_path = output_path

    if (file.name.endsWith('.gz')) {
      final_path = output_path.replace('.gz', '')
      final_content = await inflate_async(content)
    }

    await writeFile(final_path, final_content)
  }

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(file => process_file(file))
    )

    results.forEach(result => {
      if (result.status === 'fulfilled') successful++
      else {
        failed++
        console.error(chalk.red('✗ Failed:'), result.reason)
      }
    })

    const total = successful + failed
    const PERCENT = 100
    const progress = Math.round((total / files.length) * PERCENT)
    console.info(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
  }
  /* eslint-enable no-await-in-loop */

  console.timeEnd('Download from Firebase')
  return { successful, failed }
}
