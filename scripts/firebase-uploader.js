import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { PERCENT } from '@/utils/numbers'
import 'dotenv/config'

const DATA_DIR = 'storage'
const SERVICE_ACCOUNT_PATH = join(DATA_DIR, 'service-account.json')

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

const upload_file = async (bucket, file_path, metadata_path) => {
  try {
    console.info(chalk.cyan('\nReading metadata for: ') + chalk.dim(file_path))
    const metadata = JSON.parse(await readFile(metadata_path, 'utf-8'))

    const destination = `people/${file_path
      .replace(`${DATA_DIR}/compressed/`, '')
      .replace(/^\/+/, '')}`
    console.info(chalk.dim('Destination: ') + destination)

    console.info(chalk.yellow('Uploading...'))
    await bucket.upload(file_path, {
      metadata,
      destination
    })

    console.info(chalk.green('✓ Upload successful'))
    return true
  } catch (error) {
    console.error(chalk.red('✗ Upload failed:'), error)
    return false
  }
}

export const upload_to_firebase = async files => {
  try {
    const bucket = await init_firebase()

    console.info(chalk.bold('\nStarting uploads:'))
    console.info(chalk.dim('Files to process: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    /* eslint-disable no-await-in-loop */
    for (const { compressed_path, metadata_path } of files) {
      if (await upload_file(bucket, compressed_path, metadata_path))
        successful++
      else failed++

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / files.length) * PERCENT)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${files.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */

    // Final summary
    console.info(
      chalk.bold('\nUpload Summary:'),
      chalk.dim('Total files: '),
      chalk.green(successful + failed),
      chalk.dim('Successful: '),
      chalk.green(successful),
      chalk.dim('Failed: '),
      failed > 0 ? chalk.red(failed) : chalk.green('0')
    )

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red.bold('Upload process failed:'), error)
    throw error
  }
}
